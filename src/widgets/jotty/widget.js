import credentialedProxyHandler from "utils/proxy/handlers/credentialed";

const widget = {
  api: "{url}/api/{endpoint}",
  proxyHandler: credentialedProxyHandler,
  
  allowedEndpoints: /^(checklists|notes|summary)/,
};

export default widget;