import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, extname, join, relative } from 'node:path';

const root=process.cwd();
const client=process.env.RO_CLIENT_DIR??'C:\\Program Files (x86)\\Gravity\\RagnarokOnline';
const sourceFolder=join(client,'skin','default');
const outputFolder=join(root,'public','ro','client','skin','default');
const manifestPath=join(root,'public','ro','client','manifest.json');
await mkdir(outputFolder,{recursive:true});
const files=(await readdir(sourceFolder)).filter((name)=>extname(name).toLowerCase()==='.bmp');
for(const name of files)await copyFile(join(sourceFolder,name),join(outputFolder,name));
execFileSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',join(root,'scripts','convert-bmp-transparent.ps1'),'-AssetFolder',outputFolder],{stdio:'inherit'});
const entries=[];
for(const name of files){const key=basename(name,extname(name)),output=join(outputFolder,`${key}.png`),bytes=await readFile(output);entries.push({kind:'skin-default-png',key,source:`RagnarokOnline/skin/default/${name}`,output:relative(root,output).replaceAll('\\','/'),sha256:createHash('sha256').update(bytes).digest('hex')})}
const manifest=JSON.parse(await readFile(manifestPath,'utf8'));
manifest.authorization='使用者於 2026-09-10 確認官方客戶端內容具公開使用與發布授權，後續無需重複請求';
manifest.derived=[...(manifest.derived??[]).filter((entry)=>entry.kind!=='skin-default-png'),...entries];
await writeFile(manifestPath,`${JSON.stringify(manifest,null,2)}\n`);
console.log(`已匯入 ${entries.length} 個官方 Default Skin PNG。`);
