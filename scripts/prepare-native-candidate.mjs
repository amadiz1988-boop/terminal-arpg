#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { boundedPath,digest,readJson,verifyLegacyBaseline } from '../ops/ro-stack/legacy-production-baseline.mjs';
import { groups,shutdownContract,verifyNativeRemote,git,pinned,equalHash } from '../ops/ro-stack/native-promotion-contract.mjs';
import { prepareAmendedNativeCandidate } from '../ops/ro-stack/native-candidate-amendment.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const argv=process.argv.slice(2),a=Object.fromEntries(argv.flatMap((x,i)=>x.startsWith('--')?[[x.slice(2),argv[i+1]]]:[]));
const need=(ok,code)=>{if(!ok)throw Error(code);};
try {
  need(a['build-root'] && a['production-root'],'ARGUMENTS_REQUIRED');
  const buildRoot=fs.realpathSync(a['build-root']),prod=fs.realpathSync(a['production-root']);
  need(buildRoot.toLowerCase()!==prod.toLowerCase() && !buildRoot.toLowerCase().startsWith(prod.toLowerCase()+path.sep),'OUTPUT_IN_PRODUCTION_FORBIDDEN');
  // Active first promotion: amended descendant candidate under the same lease.
  if(a['amend-active']==='true'){
    const authority=readJson(path.join(root,'docs/project-control/production-release-authority.json')).native;
    console.log(JSON.stringify({...prepareAmendedNativeCandidate({buildRoot,prod,authority}),lease_acquired:false,production_mutated:false}));
    process.exit(0);
  }
  const b=readJson(path.join(buildRoot,'build-receipt.json'));
  const authority=readJson(path.join(root,'docs/project-control/production-release-authority.json')).native;
  verifyNativeRemote(b.source_root,b.native_git_sha,authority);
  need(git(b.source_root,'rev-parse','HEAD')===b.native_git_sha && !git(b.source_root,'status','--porcelain=v1','--untracked-files=all'),'SOURCE_NOT_CLEAN');
  need(b.schema_version==='native-build-v1' && b.source_tree_state==='CLEAN' && b.build_configuration==='Release x64' && b.tests_result==='PASS','BUILD_RECEIPT_INVALID');
  need(b.artifacts.length===3 && b.artifacts.every(x=>equalHash(digest(boundedPath(b.source_root,x.path)),x.sha256)),'BUILD_ARTIFACT_CHANGED');
  need(b.config_artifacts?.length===1 && b.config_artifacts[0].source_path==='conf/persistent_agent_commands.json' &&
    b.config_artifacts[0].candidate_package_path==='source/conf/persistent_agent_commands.json' &&
    b.config_artifacts[0].source_git_sha===b.native_git_sha &&
    equalHash(digest(boundedPath(buildRoot,b.config_artifacts[0].candidate_package_path)),b.config_artifacts[0].sha256) &&
    git(b.source_root,'rev-parse',`HEAD:${b.config_artifacts[0].source_path}`)===b.config_artifacts[0].source_blob_oid,
  'BUILD_COMMAND_CONTRACT_CHANGED');
  for(const s of b.tests_run)pinned(buildRoot,s.receipt);
  const rows=Object.entries(groups).map(([group,test_suite])=>{
    const suite=b.tests_run.find(x=>x.test_suite===test_suite);need(suite?.result==='PASS','REGRESSION_GROUP_MISSING:'+group);
    return {group,test_suite,result:suite.result,receipt:suite.receipt};
  });
  need(shutdownContract(b.source_root),'SHUTDOWN_SOURCE_CONTRACT_FAILED');
  const state=readJson(boundedPath(prod,'.local/ro-stack/production-deployment-state.json'));
  const baseline=verifyLegacyBaseline(prod,state);
  need(baseline.pass && baseline.rollbackReady && state.production_drift==='CLOSED','LEGACY_BASELINE_OR_ROLLBACK_FAILED');
  const accepted=readJson(boundedPath(prod,state.accepted_capability_manifest));
  need(accepted.capabilities.length===18,'LEGACY_CAPABILITY_COUNT_CHANGED');
  const registry=readJson(path.join(root,'docs/project-control/production-capabilities.json')).capabilities;
  const comparison={schema_version:'native-capabilities-v1',native_git_sha:b.native_git_sha,baseline_sha256:state.accepted_capability_manifest_sha256,
    acceptance_scope:'SOURCE_CONTRACT; WEB rows require independent combined Web preflight; no live acceptance',
    capabilities:accepted.capabilities.map(x=>{
      const definition=registry.find(y=>y.id===x.id);need(definition?.source_paths?.length,'CAPABILITY_DEFINITION_MISSING');
      if(definition.scope==='NATIVE')for(const p of definition.source_paths)git(b.source_root,'cat-file','-e',`${b.native_git_sha}:${p}`);
      return {id:x.id,classification:'PRESERVED',scope:definition.scope||'WEB',source_paths:definition.source_paths,
        evidence:definition.scope==='NATIVE'?'native-regression.json':'COMBINED_WEB_PREFLIGHT_REQUIRED'};
    })};
  const write=(name,value)=>fs.writeFileSync(path.join(buildRoot,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
  const pin=name=>({path:name,sha256:digest(path.join(buildRoot,name))});
  write('native-regression.json',{schema_version:'native-regression-v1',native_git_sha:b.native_git_sha,result:'PASS',
    groups:rows,shutdown_source_contract:{result:'PASS',files:['src/map/map.cpp','src/map/persistent_agent.cpp','src/map/persistent_agent_state.cpp'].map(p=>({path:p,sha256:digest(boundedPath(b.source_root,p))}))}});
  write('capability-comparison.json',comparison);
  const lifecycle=['ro-stack.ps1','stack.config.psd1','runtime-guard.ps1','runtime-guard.lib.ps1','graceful-console-signal.ps1'].map(n=>{
    const p='ops/ro-stack/'+n;return {path:p,sha256:digest(boundedPath(prod,p))};
  });
  const m={schema_version:'native-candidate-v1',candidate_id:'native-'+randomUUID(),native_git_sha:b.native_git_sha,binary_sha256:b.binary_sha256,
    build_receipt:pin('build-receipt.json'),regression:pin('native-regression.json'),canonical_repository:b.canonical_repository,canonical_branch:'main',
    config_artifacts:b.config_artifacts,
    required_database:'ragnarok',required_runtime_ports:[6901,6122,5122,8788],required_openkore_count:0,
    required_capability_baseline:{path:state.accepted_capability_manifest,sha256:state.accepted_capability_manifest_sha256},
    capability_comparison:pin('capability-comparison.json'),rollback_reference:{root:state.legacy_rollback.root,current_native_binary_sha256:state.current_native_binary_sha256},
    lifecycle_files:lifecycle};
  write('candidate-manifest.json',m);
  console.log(JSON.stringify({manifest:path.join(buildRoot,'candidate-manifest.json'),sha256:digest(path.join(buildRoot,'candidate-manifest.json')),
    native_predeploy_regression:'PASS',groups:rows.length,legacy_capabilities:accepted.capabilities.length,rollback_hash_match:true,
    current_native_binary_sha256:state.current_native_binary_sha256,legacy_native_rollback_sha256:digest(boundedPath(prod,`${state.legacy_rollback.root}/${state.current_native_binary_path}`)),
    lease_acquired:false,production_mutated:false}));
}catch(e){console.log(JSON.stringify({result:'BLOCKED',error:e.message}));process.exitCode=1;}
