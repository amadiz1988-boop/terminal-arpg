"""Canonical private GitHub build. Outputs stay outside source and Production."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import urllib.request
import uuid
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
REPO = 'amadiz1988-boop/ghost-island-rathena'
URL = 'https://github.com/' + REPO + '.git'


def require(ok, code):
    if not ok:
        raise ValueError(code)


def read(p):
    return json.loads(Path(p).read_text(encoding='utf-8-sig'))


def digest(p):
    return hashlib.file_digest(open(p, 'rb'), 'sha256').hexdigest().upper()


def run(args, cwd=ROOT, log=None):
    if log:
        with open(log, 'w', encoding='utf-8') as out:
            r = subprocess.run(args, cwd=cwd, stdout=out, stderr=subprocess.STDOUT)
        require(r.returncode == 0, 'COMMAND_FAILED:' + Path(str(args[0])).name)
        return ''
    r = subprocess.run(args, cwd=cwd, capture_output=True, text=True, encoding='utf-8', errors='replace')
    require(r.returncode == 0, 'COMMAND_FAILED:' + Path(str(args[0])).name)
    return r.stdout.strip()


def remote_metadata():
    token = os.environ.get('GH_TOKEN') or os.environ.get('GITHUB_TOKEN')
    if not token:
        r = subprocess.run(['git', 'credential', 'fill'], input='protocol=https\nhost=github.com\n\n',
                           capture_output=True, text=True, cwd=ROOT, timeout=20,
                           env={**os.environ, 'GCM_INTERACTIVE': 'Never', 'GIT_TERMINAL_PROMPT': '0'})
        token = dict(x.split('=', 1) for x in r.stdout.splitlines() if '=' in x).get('password')
    require(bool(token), 'GITHUB_AUTH_REQUIRED')
    req = urllib.request.Request('https://api.github.com/repos/' + REPO,
          headers={'Authorization': 'Bearer ' + token, 'User-Agent': 'ghost-island-native-build',
                   'Accept': 'application/vnd.github+json'})
    # Never forward credentials to a redirect destination.
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *args, **kwargs):
            return None
    with urllib.request.build_opener(NoRedirect).open(req, timeout=30) as response:
        meta = json.load(response)
    require(meta.get('private') is True and meta.get('full_name') == REPO and
            meta.get('default_branch') == 'main', 'CANONICAL_PRIVATE_MAIN_REQUIRED')
    return {'repository': REPO, 'private': True, 'branch': 'main'}


def execute(args):
    authority = read(ROOT / 'docs/project-control/production-release-authority.json')['native']
    require(args.sha == authority['accepted_source_sha'] and authority['github_repository'] == URL,
            'NATIVE_SHA_NOT_APPROVED')
    metadata = remote_metadata()
    if args.verify_remote_only:
        return metadata
    require(bool(args.output), 'OUTPUT_REQUIRED')
    dest = Path(args.output).resolve()
    production = Path(r'C:\Users\Administrator\ghost-island-production\ro-stack').resolve()
    require(not dest.exists() and not dest.is_relative_to(ROOT) and not dest.is_relative_to(production),
            'FRESH_EXTERNAL_OUTPUT_REQUIRED')
    dest.mkdir(parents=True, exist_ok=False)
    src = dest / 'source'
    run(['git', 'clone', '--no-tags', '--single-branch', '--branch', 'main', URL, str(src)])
    run(['git', 'merge-base', '--is-ancestor', args.sha, 'origin/main'], src)
    run(['git', 'checkout', '--detach', args.sha], src)
    require(run(['git', 'status', '--porcelain=v1', '--untracked-files=all'], src) == '', 'SOURCE_NOT_CLEAN')
    vswhere = r'C:\Program Files (x86)\Microsoft Visual Studio\Installer\vswhere.exe'
    msbuild = run([vswhere, '-latest', '-products', '*', '-requires', 'Microsoft.Component.MSBuild',
                   '-find', r'MSBuild\**\Bin\MSBuild.exe']).splitlines()[0]
    version = run([msbuild, '-nologo', '-version'])
    print('REMOTE_PRIVATE_MAIN_VERIFIED; FRESH_SOURCE_CLEAN; BUILD_STARTED', flush=True)
    run([msbuild, 'rAthena.sln', '/m:4', '/p:Configuration=Release', '/p:Platform=x64', '/nologo'],
        src, dest / 'build.log')
    tests = dest / 'tests'
    run(['powershell.exe', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File',
         str(src / 'tools/canonical-source-validation/run-offline.ps1'), '-OutputDirectory', str(tests)],
        src, dest / 'regression.log')
    results = read(tests / 'results.json')
    require(results and all(x['exitCode'] == 0 for x in results), 'REGRESSION_FAILED')
    # These are the only unignored outputs of the pinned canonical test programs.
    # Remove exact generated files inside this newly created clone, never source.
    generated = []
    for folder, name in [('pa-command-contract', 'test_pa_contract'),
                         ('pa-fly-rejection', 'test_fly_rejection'),
                         ('pa-quarantine-idle-recovery', 'test_quarantine_idle_recovery'),
                         ('pa-recovery-policy', 'test_recovery_policy')]:
        for suffix in ['exe', 'obj']:
            p = src / 'tools' / folder / 'out' / (name + '.' + suffix)
            if p.exists():
                require(p.resolve().is_relative_to(src.resolve()) and not p.is_symlink(), 'GENERATED_PATH_INVALID')
                generated.append({'path': p.relative_to(src).as_posix(), 'sha256': digest(p)})
                p.unlink()
    require(run(['git', 'status', '--porcelain=v1', '--untracked-files=all'], src) == '', 'SOURCE_NOT_CLEAN_AFTER_BUILD')
    require(run(['git', 'rev-parse', 'HEAD'], src) == args.sha, 'SOURCE_SHA_CHANGED')
    artifacts = [{'path': name + '-server.exe', 'sha256': digest(src / (name + '-server.exe'))}
                 for name in ['login', 'char', 'map']]
    suites = []
    for item in results:
        log = tests / ('m1-policy.log' if item['test'] == 'C++ M1 supply policy' else Path(item['test']).name + '.log')
        suites.append({'test_suite': item['test'], 'result': 'PASS',
                       'receipt': {'path': log.relative_to(dest).as_posix(), 'sha256': digest(log)}})
    receipt = {'schema_version': 'native-build-v1', 'build_id': 'native-' + uuid.uuid4().hex,
               'built_at': datetime.now(timezone.utc).isoformat(), 'native_git_sha': args.sha,
               'canonical_repository': URL, 'canonical_branch': 'main', 'build_configuration': 'Release x64',
               'toolchain': {'msbuild': msbuild, 'version': version}, 'binary_path': 'source/map-server.exe',
               'binary_sha256': artifacts[2]['sha256'], 'artifacts': artifacts, 'source_root': str(src),
               'source_tree_state': 'CLEAN', 'tests_run': suites, 'tests_result': 'PASS',
               'remote': metadata, 'generated_test_outputs': generated,
               'build_log': {'path': 'build.log', 'sha256': digest(dest / 'build.log')}}
    with open(dest / 'build-receipt.json', 'x', encoding='utf-8') as f:
        json.dump(receipt, f, indent=2)
    return {'build_receipt': str(dest / 'build-receipt.json'), 'sha256': digest(dest / 'build-receipt.json'),
            'tests': len(suites), 'result': 'PASS'}


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--sha', required=True)
    p.add_argument('--output')
    p.add_argument('--verify-remote-only', action='store_true')
    try:
        print(json.dumps(execute(p.parse_args())))
    except Exception as error:
        # Error text never contains the credential or HTTP request headers.
        print(json.dumps({'result': 'FAIL', 'error': str(error)}))
        raise SystemExit(1)
