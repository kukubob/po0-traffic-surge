/**
 * po0 VPS 剩余流量查询
 * 用于 Surge Panel，登录 console.po0.com 获取流量数据
 * 凭据通过模块参数传入，脚本本身不含敏感信息
 */

// 从模块参数中解析 email 和 password
const args = Object.fromEntries(
  ($argument || "").split("&").map((p) => p.split("=").map(decodeURIComponent))
);
const EMAIL = args.email;
const PASSWORD = args.password;

if (!EMAIL || !PASSWORD) {
  $done({
    title: "po0 流量监控",
    content: "❌ 请在模块设置中填写 email 和 password",
    icon: "xmark.circle.fill",
    "icon-color": "#E74C3C",
  });
}

const BASE_URL = "https://console.po0.com";
const PRODUCT_ID = 694;

const LOGIN_URL = `${BASE_URL}/dologin.php`;
const API_URL = `${BASE_URL}/modules/servers/penguin/api/productInfo.php?serviceId=${PRODUCT_ID}`;

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function bytesToGB(kb) {
  return (kb * 1024 / Math.pow(1024, 3)).toFixed(1);
}

function fail(message) {
  $done({
    title: "po0 流量监控",
    content: "❌ " + message,
    icon: "xmark.circle.fill",
    "icon-color": "#E74C3C",
  });
}

// Step 1: 获取登录页面，提取 CSRF token
$httpClient.get(
  {
    url: `${BASE_URL}/login`,
    headers: { "User-Agent": UA },
    timeout: 15,
  },
  function (error, response, data) {
    if (error) return fail("获取登录页失败: " + error);

    // 用正则提取 CSRF token
    const tokenMatch = data.match(
      /name=["']token["']\s+value=["']([^"']+)["']/i
    );
    const tokenMatch2 = data.match(
      /value=["']([^"']+)["']\s+name=["']token["']/i
    );
    const token = tokenMatch
      ? tokenMatch[1]
      : tokenMatch2
      ? tokenMatch2[1]
      : "";

    // Step 2: 登录
    $httpClient.post(
      {
        url: LOGIN_URL,
        headers: {
          "User-Agent": UA,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `username=${encodeURIComponent(EMAIL)}&password=${encodeURIComponent(PASSWORD)}&token=${encodeURIComponent(token)}`,
        timeout: 15,
      },
      function (error2, response2, data2) {
        if (error2) return fail("登录请求失败: " + error2);

        if (data2 && data2.toLowerCase().includes("incorrect")) {
          return fail("登录失败，用户名或密码错误");
        }

        // Step 3: 获取流量数据
        $httpClient.get(
          {
            url: API_URL,
            headers: { "User-Agent": UA },
            timeout: 15,
          },
          function (error3, response3, data3) {
            if (error3) return fail("获取流量失败: " + error3);

            try {
              const info = JSON.parse(data3);
              const totalGB = bytesToGB(info.totalTransfer);
              const remainGB = bytesToGB(info.remainingTransfer);
              const percent = (
                (info.remainingTransfer / info.totalTransfer) *
                100
              ).toFixed(1);

              // 根据剩余比例选择图标颜色
              let iconColor = "#6ECB63"; // 绿色
              if (percent < 20) {
                iconColor = "#E74C3C"; // 红色
              } else if (percent < 50) {
                iconColor = "#F39C12"; // 橙色
              }

              $done({
                title: "po0 流量监控",
                content: `剩余: ${remainGB} GB / ${totalGB} GB (${percent}%)`,
                icon: "arrow.up.arrow.down.circle.fill",
                "icon-color": iconColor,
              });
            } catch (e) {
              fail("解析数据失败: " + e.message);
            }
          }
        );
      }
    );
  }
);
