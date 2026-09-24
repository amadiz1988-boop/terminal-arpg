"""Fetch and verify the Git-pinned immutable private package. No remote mutations."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
import os
from pathlib import Path
import stat
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile


def require(ok, message):
    if not ok:
        raise ValueError(message)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def execute(args):
    root = Path(args.checkout).resolve(strict=True)
    config = read(root / 'docs/project-control/web-runtime-private-release-v1.json')
    lock = read(root / 'docs/project-control/web-runtime-asset-package-lock-v1.json')
    manifest = read(root / 'docs/project-control/web-runtime-assets-manifest-v1.json')
    production = Path(manifest['production_evidence_root']).resolve()
    require(not root.is_relative_to(production), 'production_checkout_forbidden')
    repo = 'amadiz1988-boop/ghost-island-assets'
    require(config['repository'] == repo and config['immutable_required'] is True, 'authority_invalid')
    for key in ('package_id', 'package_version', 'asset_count', 'package_sha256', 'manifest_sha256'):
        require(config[key] == lock[key], 'release_lock_mismatch')
    token = os.environ.get('GH_TOKEN') or os.environ.get('GITHUB_TOKEN')
    if not token:
        result = subprocess.run(['git', 'credential', 'fill'], input='protocol=https\nhost=github.com\n\n',
            text=True, capture_output=True, cwd=root, timeout=20,
            env={**os.environ, 'GCM_INTERACTIVE': 'Never', 'GIT_TERMINAL_PROMPT': '0'})
        values = dict(line.split('=', 1) for line in result.stdout.splitlines() if '=' in line)
        require(result.returncode == 0 and bool(values.get('password')), 'private_auth_unavailable')
        token = values['password']
    headers = {'Authorization': 'Bearer ' + token, 'User-Agent': 'ghost-island-private-assets-v6',
               'X-GitHub-Api-Version': '2022-11-28'}
    opener = urllib.request.build_opener(NoRedirect)

    def metadata(suffix):
        request = urllib.request.Request('https://api.github.com/repos/' + repo + suffix,
            headers={**headers, 'Accept': 'application/vnd.github+json'})
        with opener.open(request, timeout=30) as response:
            data = response.read(1024 * 1024 + 1)
        require(len(data) <= 1024 * 1024, 'metadata_limit')
        return json.loads(data)

    repository = metadata('')
    release = metadata('/releases/' + str(config['release_id']))
    require(repository.get('private') is True and repository.get('full_name') == repo, 'private_repository_required')
    require(release.get('id') == config['release_id'] and release.get('tag_name') == config['release_tag']
            and release.get('draft') is False and release.get('immutable') is True, 'immutable_release_required')
    by_id = {a['id']: a for a in release.get('assets', [])}
    for key in ('archive', 'manifest'):
        expected = config[key]
        actual = by_id.get(expected['id'], {})
        require(all(actual.get(k) == expected[k] for k in ('id', 'name', 'size')) and
                actual.get('state') == 'uploaded' and actual.get('digest') == 'sha256:' + expected['sha256'], 'release_asset_mismatch')
    proof = {'available': True, 'repository': repo, 'private': True, 'immutable': True,
        'release_id': config['release_id'], 'release_tag': config['release_tag'],
        'archive_sha256': config['archive']['sha256'], 'manifest_sha256': lock['manifest_sha256']}
    if args.verify_release_only:
        require(not args.materialize, 'conflicting_modes')
        return proof
    require(bool(args.destination), 'private_destination_required')
    destination = Path(args.destination).resolve()
    require(not destination.exists() and not destination.is_relative_to(root) and
            not destination.is_relative_to(production), 'unsafe_destination')
    destination.mkdir(parents=True, exist_ok=False)

    def download(item):
        require(Path(item['name']).name == item['name'] and '\\' not in item['name'] and ':' not in item['name'], 'unsafe_asset_name')
        def signed_url():
            request = urllib.request.Request('https://api.github.com/repos/' + repo + '/releases/assets/' + str(item['id']) + '?download_nonce=' + str(time.time_ns()),
                headers={**headers, 'Accept': 'application/octet-stream'})
            try:
                with urllib.request.build_opener(NoRedirect).open(request, timeout=30):
                    raise ValueError('signed_redirect_required')
            except urllib.error.HTTPError as error:
                require(error.code == 302, 'asset_redirect_failed')
                value = error.headers.get('Location', '')
            target = urllib.parse.urlparse(value)
            require(target.scheme == 'https' and (target.hostname or '').endswith('.githubusercontent.com'), 'untrusted_download_host')
            return value
        url = signed_url()
        require(0 < item['size'] < 2**31, 'asset_size_invalid')

        def chunk(start):
            end = min(start + 1024**2, item['size']) - 1
            for attempt in range(4):
                try:
                    request = urllib.request.Request(url if attempt == 0 else signed_url(), headers={'User-Agent': headers['User-Agent'], 'Range': f'bytes={start}-{end}'})
                    with urllib.request.build_opener(NoRedirect).open(request, timeout=30) as response:
                        require(response.status == 206 and response.headers.get('Content-Range') == f"bytes {start}-{end}/{item['size']}", 'invalid_range')
                        data = response.read(end - start + 2)
                    require(len(data) == end - start + 1, 'invalid_chunk_size')
                    return data
                except (TimeoutError, urllib.error.URLError) as error:
                    if attempt == 3 or (isinstance(error, urllib.error.HTTPError) and error.code < 500):
                        raise
                    time.sleep(attempt + 1)

        output = destination / item['name']
        actual_hash = hashlib.sha256()
        with ThreadPoolExecutor(max_workers=4) as pool, output.open('xb') as stream:
            for data in pool.map(chunk, range(0, item['size'], 1024**2)):
                stream.write(data)
                actual_hash.update(data)
        require(actual_hash.hexdigest() == item['sha256'], 'remote_file_hash_mismatch')
        return output

    archive = download(config['archive'])
    manifest_file = download(config['manifest'])
    manifest_bytes = manifest_file.read_bytes()
    require(digest(manifest_bytes) == lock['manifest_sha256'], 'manifest_digest_mismatch')
    remote = json.loads(manifest_bytes)
    require(remote == manifest and len(remote['assets']) == lock['asset_count'], 'manifest_content_mismatch')
    expected = {'asset-package.json': None, 'manifest.json': None, 'provenance.json': None}
    tree_rows = ''
    for asset in remote['assets']:
        path = asset['relative_path']
        approved = path.startswith(('public/ro/client/', 'ops/ro-stack/dashboard/assets/pets/')) or path == 'ops/ro-stack/dashboard/skill-ui-assets.json'
        require(approved and ':' not in path and '\\' not in path and all(p not in ('', '.', '..') for p in path.split('/')), 'unsafe_package_path')
        name = 'assets/' + path
        require(name not in expected, 'duplicate_manifest_path')
        expected[name] = asset
        tree_rows += f"{path}\0{asset['size']}\0{asset['sha256']}\n"
    tree_hash = digest(tree_rows.encode())
    require(tree_hash == remote['expected_package_tree_sha256'], 'asset_tree_mismatch')
    package_root = destination / 'package'
    with zipfile.ZipFile(archive) as package:
        names = package.namelist()
        require(set(names) == set(expected) and len(names) == len(expected) and len(set(n.casefold() for n in names)) == len(names), 'unexpected_archive_entries')
        for entry in package.infolist():
            asset = expected[entry.filename]
            require(not entry.is_dir() and not stat.S_ISLNK(entry.external_attr >> 16), 'archive_link_forbidden')
            require(entry.file_size == asset['size'] if asset else entry.file_size <= 8 * 1024**2, 'entry_size_invalid')
        require(package.read('manifest.json') == manifest_bytes, 'embedded_manifest_mismatch')
        rows = ''
        for name in ('asset-package.json', 'manifest.json', 'provenance.json'):
            data = package.read(name)
            rows += f'{name}\0{len(data)}\0{digest(data)}\n'
        package_hash = digest((rows + 'asset-tree\0' + tree_hash + '\n').encode())
        require(package_hash == lock['package_sha256'], 'package_digest_mismatch')
        for name, asset in expected.items():
            if asset:
                require(digest(package.read(name)) == asset['sha256'], 'asset_hash_mismatch')
        package_root.mkdir()
        for name in names:
            output = package_root.joinpath(*name.split('/'))
            output.parent.mkdir(parents=True, exist_ok=True)
            with output.open('xb') as stream:
                stream.write(package.read(name))
    command = ['node', str(root / 'scripts/materialize-web-runtime-assets.mjs'), '--mode',
        'materialize' if args.materialize else 'verify-package', '--checkout', str(root), '--asset-package', str(package_root)]
    result = subprocess.run(command, cwd=root, capture_output=True, text=True, timeout=120)
    require(result.returncode == 0, 'materializer_verification_failed')
    proof.update({'package_sha256': package_hash, 'package_root': str(package_root), 'verification': json.loads(result.stdout)})
    (destination / 'download-receipt.json').write_text(json.dumps(proof, indent=2) + '\n', encoding='utf-8')
    return proof


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--checkout', required=True)
    parser.add_argument('--destination')
    parser.add_argument('--materialize', action='store_true')
    parser.add_argument('--verify-release-only', action='store_true')
    try:
        print(json.dumps(execute(parser.parse_args())))
    except Exception as error:
        print(json.dumps({'ok': False, 'error': str(error) if isinstance(error, ValueError) else type(error).__name__}))
        raise SystemExit(1)
