import assert from 'node:assert/strict';
import test from 'node:test';
import { createExternalIdentityStore, hasPasswordCredential } from '../ops/ro-stack/account-external-identity.mjs';
import { createDiscordAccountAuth, createDiscordRouteHandler } from '../ops/ro-stack/discord-account-auth.mjs';

// Scripted mysql2 connection: executes the real persistence adapter and verifies
// transaction boundaries. This is a component contract test, not MariaDB proof.
function fixture(steps) {
  const events = [];
  const connection = {
    async beginTransaction() { events.push('begin'); },
    async commit() { events.push('commit'); },
    async rollback() { events.push('rollback'); },
    release() { events.push('release'); },
    async query({ sql, values, rowsAsArray }) {
      const step = steps.shift();
      assert.ok(step, 'Unexpected SQL');
      assert.match(sql, step.sql);
      assert.equal(rowsAsArray, false);
      step.check?.(values, sql);
      if (step.error) throw step.error;
      return [step.rows ?? []];
    },
  };
  return {
    store: createExternalIdentityStore({ getConnection: async () => connection }),
    finish(expected) { assert.deepEqual(events, expected); assert.equal(steps.length, 0); },
  };
}
const time = 1800000000000;
const state = {
  state_hash:'state', browser_hash:'browser', session_hash:'session',
  provider:'discord', intent:'LOGIN', account_id:null, consumed_at:null,
  expires_at:time+100, redirect_uri:'https://game.example/auth/discord/callback',
};
const input = {stateHash:'state', browserHash:'browser', sessionHash:'session', redirectUri:state.redirect_uri, now:time};
for (const [name, changed] of [
  ['consumed', {consumed_at:time-1}], ['expired', {expires_at:time}],
  ['browser mismatch', {browser_hash:'different'}], ['session mismatch', {session_hash:'different'}],
  ['redirect mismatch', {redirect_uri:'https://other.example/auth/discord/callback'}],
  ['provider mismatch', {provider:'other'}],
]) {
  test('state rejects '+name, async () => {
    const f=fixture([{sql:/SELECT .*FOR UPDATE/,rows:[{...state,...changed}]}]);
    await assert.rejects(f.store.consumeState(input), {message:'discord_oauth_state_invalid'});
    f.finish(['begin','rollback','release']);
  });
}
test('state consumption commits before provider redemption', async () => {
  const f=fixture([
    {sql:/SELECT .*FOR UPDATE/,rows:[state]},
    {sql:/UPDATE web_oauth_state SET consumed_at/,check:values=>assert.deepEqual(values,[time,'state'])},
  ]);
  assert.deepEqual(await f.store.consumeState(input),{intent:'LOGIN',accountId:null});
  f.finish(['begin','commit','release']);
});
test('login resolves stable identity and atomically replaces session', async () => {
  const f=fixture([
    {sql:/SELECT .*account_external_identity.*FOR UPDATE/,rows:[{id:1,account_id:42}], check:v=>assert.deepEqual(v,['123456789'])},
    {sql:/SELECT account_id FROM login/,rows:[{account_id:42}]},
    {sql:/UPDATE account_external_identity SET display_name/},
    {sql:/DELETE FROM web_sessions/,check:v=>assert.deepEqual(v,['old-hash'])},
    {sql:/INSERT INTO web_sessions/,check:v=>assert.deepEqual(v,['new-hash',42,time,time+7*86400000])},
    {sql:/INSERT INTO web_account_activity/},
  ]);
  assert.deepEqual(await f.store.finish({state:{intent:'LOGIN'},identity:{providerUserId:'123456789',displayName:'display only',avatarUrl:null},oldSessionHash:'old-hash',newSessionHash:'new-hash',now:time}),{accountId:42});
  f.finish(['begin','commit','release']);
});
test('unknown identity never creates account or session', async () => {
  const f=fixture([{sql:/SELECT .*account_external_identity.*FOR UPDATE/,rows:[]}]);
  await assert.rejects(f.store.finish({state:{intent:'LOGIN'},identity:{providerUserId:'123456789'},now:time}),{message:'discord_account_not_linked'});
  f.finish(['begin','rollback','release']);
});
test('second account cannot take existing Discord identity', async () => {
  const f=fixture([
    {sql:/SELECT s\.\* FROM web_sessions/,rows:[{account_id:43}]},
    {sql:/SELECT account_id FROM web_accounts.*FOR UPDATE/},
    {sql:/SELECT .*account_external_identity.*FOR UPDATE/,rows:[{account_id:42}]},
  ]);
  await assert.rejects(f.store.finish({state:{intent:'LINK',accountId:43},identity:{providerUserId:'123456789'},now:time}),{message:'discord_identity_already_linked'});
  f.finish(['begin','rollback','release']);
});
test('unique-key race rolls back without exposing database text', async () => {
  const f=fixture([
    {sql:/SELECT s\.\* FROM web_sessions/,rows:[{account_id:43}]},
    {sql:/SELECT account_id FROM web_accounts/},
    {sql:/SELECT .*account_external_identity/,rows:[]},
    {sql:/SELECT account_id FROM login/,rows:[{account_id:43}]},
    {sql:/INSERT INTO account_external_identity/,error:Object.assign(new Error('private SQL'),{code:'ER_DUP_ENTRY'})},
  ]);
  await assert.rejects(f.store.finish({state:{intent:'LINK',accountId:43},identity:{providerUserId:'123456789'},now:time}),{message:'discord_identity_already_linked'});
  f.finish(['begin','rollback','release']);
});
for (const alternative of [true,false]) {
  test('unlink alternative credential '+alternative, async () => {
    const rows=alternative?[{password_salt:'a'.repeat(32),password_hash:'b'.repeat(128)}]:[];
    const f=fixture([
      {sql:/SELECT s\.\* FROM web_sessions/,rows:[{account_id:42}]},
      {sql:/SELECT password_salt,password_hash.*FOR UPDATE/,rows},
      ...(alternative?[{sql:/DELETE FROM account_external_identity/}]:[]),
    ]);
    const action=f.store.unlink({accountId:42,sessionHash:'hash',now:time});
    if(alternative) assert.deepEqual(await action,{unlinked:true});
    else await assert.rejects(action,{message:'discord_unlink_requires_alternative_login'});
    f.finish(['begin',alternative?'commit':'rollback','release']);
  });
}
test('support sessions cannot manage identity', async () => {
  const f=fixture([{sql:/SELECT s\.\* FROM web_sessions/,rows:[{account_id:42,support_session_id:'support'}]}]);
  await assert.rejects(f.store.unlink({accountId:42,sessionHash:'hash',now:time}),{message:'discord_link_session_required'});
  f.finish(['begin','rollback','release']);
});
test('pool acquisition failure is redacted', async () => {
  const store=createExternalIdentityStore({getConnection:async()=>{throw Error('mysql password=private');}});
  await assert.rejects(store.identity(42), {message:'discord_storage_unavailable'});
  assert.equal(hasPasswordCredential({password_salt:'invalid',password_hash:'b'.repeat(128)}),false);
});
const env={DISCORD_CLIENT_ID:'app',DISCORD_CLIENT_SECRET:'server-only-secret',DISCORD_REDIRECT_URI:'https://game.example/auth/discord/callback'};
const req={headers:{host:'game.example',cookie:''},method:'GET'};
function response() { return {status:0,headers:{},body:'',writeHead(s,h){this.status=s;this.headers=h;},end(b=''){this.body=b;}}; }
test('authorization route uses identify and secure HttpOnly cookie', async () => {
  const auth=createDiscordAccountAuth({env,store:{createState:async()=>{}}});
  const route=createDiscordRouteHandler({auth,getAccount:async()=>null,originAllowed:()=>true});
  const res=response();
  await route(new URL('https://game.example/auth/discord'),req,res);
  assert.equal(res.status,303);
  const url=new URL(res.headers.location);
  assert.equal(url.origin,'https://discord.com');
  assert.equal(url.searchParams.get('scope'),'identify');
  assert.equal(url.searchParams.get('response_type'),'code');
  assert.match(res.headers['set-cookie'],/HttpOnly.*SameSite=Lax.*Secure/);
  assert.ok(!JSON.stringify(res).includes(env.DISCORD_CLIENT_SECRET));
});
test('cross-origin linking is rejected before session lookup', async () => {
  const route=createDiscordRouteHandler({auth:{},getAccount:()=>assert.fail('lookup'),originAllowed:()=>false});
  const res=response();
  await route(new URL('https://game.example/api/account/discord/link'),{...req,method:'POST'},res);
  assert.equal(res.status,403);
});
test('redirect host mismatch rejects before creating state', async () => {
  const auth=createDiscordAccountAuth({env,store:{createState:()=>assert.fail('state')}});
  await assert.rejects(auth.begin({headers:{host:'other.example'}},'LOGIN'),{message:'discord_redirect_origin_mismatch'});
});
test('guild seam fails closed and accepts verified membership', async () => {
  const store={identity:async()=>({provider_user_id:'123456789',display_name:'name'})};
  const config={env:{...env,DISCORD_GUILD_MEMBERSHIP_REQUIRED:'true',DISCORD_GUILD_ID:'guild'},store};
  assert.equal((await createDiscordAccountAuth(config).view({accountId:42})).accessGate,'discord_guild_membership_unavailable');
  assert.equal((await createDiscordAccountAuth({...config,guildMembershipChecker:async()=>true}).view({accountId:42})).accessGate,null);
});
