// 개발자 Firebase CLI의 로그인 세션으로 프로젝트 설정을 관리한다. 인증 값은 출력하지 않는다.
const path = require('node:path');
const root = path.join(process.env.APPDATA, 'npm/node_modules/firebase-tools/lib');
const { Client } = require(path.join(root, 'apiv2'));
const { getGlobalDefaultAccount } = require(path.join(root, 'auth'));
const { requireAuth } = require(path.join(root, 'requireAuth'));
const project = 'voxel-fishing-choi';
const quiet = { skipLog: { reqBody: true, resBody: true } };
(async () => {
  await requireAuth({ ...getGlobalDefaultAccount(), project, nonInteractive: true });
  const mode = process.argv[2];
  if (mode === 'enable-apis') {
    const client = new Client({ urlPrefix: 'https://serviceusage.googleapis.com', apiVersion: 'v1' });
    for (const service of ['firestore.googleapis.com', 'identitytoolkit.googleapis.com']) {
      const name = `/projects/${project}/services/${service}`;
      const state = await client.get(name, quiet);
      if (state.body.state !== 'ENABLED') await client.post(`${name}:enable`, {}, quiet);
      console.log(`${service}: enable requested`);
    }
  } else if (mode === 'auth-status') {
    const client = new Client({ urlPrefix: 'https://identitytoolkit.googleapis.com', apiVersion: 'admin/v2' });
    const config = await client.get(`/projects/${project}/config`, quiet);
    console.log(JSON.stringify({ project, authorizedDomains: config.body.authorizedDomains }));
    const providers = await client.get(`/projects/${project}/defaultSupportedIdpConfigs`, quiet);
    console.log(JSON.stringify((providers.body.defaultSupportedIdpConfigs ?? []).map(p => ({ name: p.name, enabled: p.enabled, hasClientId: !!p.clientId }))));
  }
})().catch(e => { console.error(e.context?.body?.error?.message ?? e.message); process.exitCode = 1; });
