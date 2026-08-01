const CHINESE_TEXT: Record<string, string> = {
  Authorize: '授权',
  Authorized: '已授权',
  'Available authorizations': '可用的授权方式',
  'Basic authorization': '基本认证',
  'Remove authorization': '移除授权',
  Close: '关闭',
  Logout: '退出授权',
  Value: '值',
  Username: '用户名',
  Password: '密码',
  Type: '类型',
  Authorization: '认证信息',
  Servers: '服务器',
  Parameters: '参数',
  'No parameters': '无参数',
  'Request body': '请求体',
  'Request content type': '请求内容类型',
  'Request snippets': '请求示例',
  'Media type': '媒体类型',
  Response: '响应',
  Responses: '响应',
  'Response content type': '响应内容类型',
  Code: '状态码',
  Description: '说明',
  Links: '链接',
  'Try it out': '调试接口',
  Cancel: '取消',
  Execute: '发送请求',
  Clear: '清空',
  'Request URL': '请求地址',
  'Server response': '服务器响应',
  Details: '详情',
  'Response body': '响应体',
  'Response headers': '响应头',
  'Request duration': '请求耗时',
  Download: '下载',
  'Download file': '下载文件',
  Example: '示例',
  Examples: '示例',
  'Example Description': '示例说明',
  'Example Value': '示例值',
  Schema: '数据结构',
  Schemas: '数据结构',
  Model: '模型',
  deprecated: '已废弃',
  Deprecated: '已废弃',
  required: '必填',
  Required: '必填',
  'Loading...': '加载中…',
  'Filter by tag': '按分组筛选',
};

const SKIP_TEXT_SELECTOR = 'pre, code, textarea, input, select, option';

function replaceTextNode(node: Text) {
  const parent = node.parentElement;
  if (!parent || parent.closest(SKIP_TEXT_SELECTOR)) return;

  const value = node.nodeValue || '';
  const trimmed = value.trim();
  const translated = CHINESE_TEXT[trimmed];
  if (translated) node.nodeValue = value.replace(trimmed, translated);
}

function localizeAttributes(root: HTMLElement) {
  root
    .querySelectorAll<HTMLElement>('[placeholder], [title], [aria-label]')
    .forEach((element) => {
      for (const attribute of ['placeholder', 'title', 'aria-label']) {
        const value = element.getAttribute(attribute);
        const translated = value && CHINESE_TEXT[value.trim()];
        if (translated) element.setAttribute(attribute, translated);
      }
    });
}

export function localizeSwaggerUi(root: HTMLElement) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  nodes.forEach(replaceTextNode);
  localizeAttributes(root);
}
