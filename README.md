# discourse-geo-domain-redirect

根据请求头 `Ali-IP-Country` 判断访客是否来自中国，并在**前端 JavaScript** 中判断当前域名。若访客来自中国且当前域名不是 `www.xuxiaowei.com.cn`，提示访客跳转到中国站点，并允许访客选择「一段时间内不再提醒」或「永久忽略」。忽略规则保存在浏览器 `localStorage` 中。

## 工作方式

浏览器 JavaScript 无法直接读取请求头，因此插件分两步完成判断：

1. 服务端提供 `GET /geo-domain-redirect/country.json`，读取请求头 `Ali-IP-Country` 并返回国家代码，例如：

   ```json
   { "country": "CN" }
   ```

   该接口设置 `Cache-Control: no-store, private`、`Vary: Ali-IP-Country` 和 `Access-Control-Allow-Origin: *`，避免不同访客之间缓存串数据，也允许从当前域名跨域读取结果。

2. 前端初始化脚本获取当前域名和国家代码，全部判断都在前端 JavaScript 中完成：
   - 当前 `window.location.hostname` 是否等于目标域名；
   - 国家代码是否等于配置的国家代码；
   - 浏览器中是否存在未过期的忽略记录。

   满足条件时弹出提示框。选择跳转后，会保留当前路径、查询参数和锚点，并使用 `https://` 访问目标域名。

这样既满足「用前端 JS 判断域名」的要求，也避免了在 HTML 或公共 JSON 中缓存请求相关的国家信息。

## 功能

- 通过 `Ali-IP-Country` 请求头识别国家，默认 `CN`。
- 只有当前域名不是目标域名时才提示；目标域名默认 `www.xuxiaowei.com.cn`。
- 提示框提供：
  - 前往中国站点；
  - 多个可配置的「一段时间内不再提醒」时长，默认 1 天、7 天、30 天；
  - 永久忽略。
- 忽略记录写入浏览器缓存（`localStorage`），不使用服务端存储，也不依赖 Cookie。
- 请求头、国家代码、目标域名、稍后提醒时长均可通过站点设置修改，不需要改代码。
- 国家接口可以选择使用当前浏览器访问的域名，或使用配置的中国域名（例如 `www.xuxiaowei.com.cn`）。
- 可配置允许访问的域名/子域名（支持 `*` 通配符），未授权域名强制跳转到主站。
- 提示失败、接口失败或浏览器禁用存储时不会影响页面正常使用。

## 安装

把本仓库放到 Discourse 的 `plugins/discourse-geo-domain-redirect` 目录。开发环境可以使用软链接：

```bash
ln -s /path/to/discourse-geo-domain-redirect /path/to/discourse/plugins/discourse-geo-domain-redirect
```

生产环境使用 Docker 时，可把仓库挂载到容器：

```yaml
volumes:
  - /path/to/discourse-geo-domain-redirect:/var/www/discourse/plugins/discourse-geo-domain-redirect
```

首次安装或前端资源变更后，需要重新编译插件前端资源：

```bash
cd /var/www/discourse
su discourse -c 'RAILS_ENV=production LOAD_PLUGINS=1 bundle exec rake assets:precompile:build_plugins'
```

然后重启 Discourse。插件默认启用；如未启用，请在「管理后台 → 设置 → 插件」中开启 `geo_domain_redirect_enabled`。

## 站点设置

| 设置                                                | 默认值                 | 说明                                                           |
| --------------------------------------------------- | ---------------------- | -------------------------------------------------------------- |
| `geo_domain_redirect_enabled`                       | 开                     | 插件总开关                                                     |
| `geo_domain_redirect_header`                        | `Ali-IP-Country`       | 携带国家代码的请求头名称                                       |
| `geo_domain_redirect_country_code`                  | `CN`                   | 触发提示的国家代码                                             |
| `geo_domain_redirect_target_domain`                 | `www.xuxiaowei.com.cn` | 提示前往的域名，不包含协议和路径                               |
| `geo_domain_redirect_main_domain`                   | 空                     | 未授权域名强制跳转到的主站域名；留空时使用目标域名             |
| `geo_domain_redirect_allowed_domains`               | 空                     | 允许访问的域名/子域名列表，支持 `*` 通配符；留空不启用限制     |
| `geo_domain_redirect_use_target_domain_for_country` | 关                     | 从目标中国域名请求国家接口；关闭时使用当前浏览器访问的域名     |
| `geo_domain_redirect_snooze_options`                | `1\|7\|30`             | 可选的稍后提醒时长（天），每个值显示为一个按钮，按填写顺序排列 |

把 `geo_domain_redirect_target_domain` 改成其他域名后，旧域名下的忽略记录不会继续生效，这是有意设计的。

`geo_domain_redirect_snooze_options` 是列表设置：在管理后台输入天数后回车即可添加多项，例如依次添加 `1`、`7`、`30`，提示框中就会出现「1 天内不再提醒」「7 天内不再提醒」「30 天内不再提醒」三个按钮。非正整数、超过 3650 的值会被前端忽略；如果全部无效，则回退为 7 天。

### 国家接口使用哪个域名

`geo_domain_redirect_use_target_domain_for_country` 关闭时，前端请求当前站点的相对地址：

```text
/geo-domain-redirect/country.json
```

开启时，前端直接请求目标中国域名：

```text
https://www.xuxiaowei.com.cn/geo-domain-redirect/country.json
```

适用于当前域名没有透传 `Ali-IP-Country`、但中国域名所在 CDN 会写入该请求头的情况。跨域请求要求目标域名也安装并启用本插件；接口返回 `Access-Control-Allow-Origin: *`，且请求不携带 Cookie。目标域名如果被 CDN 缓存了接口响应，需要确保遵循 `Cache-Control: no-store` 或单独配置不缓存。

### 限制访问域名

`geo_domain_redirect_allowed_domains` 用于限制哪些域名可以正常使用本站。配置后，前端 JS 会检查 `window.location.hostname`：

- 匹配允许列表：继续正常加载；
- 不匹配，且配置了主站域名：使用 `window.location.replace()` 强制跳转到主站，并保留当前路径、查询参数和锚点；
- 允许列表为空：不启用限制；
- `geo_domain_redirect_main_domain` 为空时，使用 `geo_domain_redirect_target_domain` 作为主站；
- 当前域名等于主站域名时不会再次跳转，避免循环。

允许列表是列表设置，在管理后台输入后回车添加，例如：

```text
www.xuxiaowei.com.cn
xuxiaowei.com.cn
*.xuxiaowei.com.cn
www.xuxiaowei.io
xuxiaowei.io
*.xuxiaowei.io
```

`*.example.com` 只匹配子域名，不匹配 `example.com` 本身，因此主域名需要单独添加。支持 `*` 通配符，例如 `www.*.example.com`。开发环境使用 `localhost` 时，也要把 `localhost` 加入允许列表。

通配符会信任所有匹配的子域名，请只配置自己能够控制的域名；只配置 `*` 相当于放行所有域名。

> 该限制只在前端 JS 中执行，用户禁用 JS 时无法阻止页面内容加载。若需要严格防止他人把域名解析到服务器，仍建议在 Nginx、CDN 或负载均衡层增加 Host 白名单校验。

## 请求头要求

`Ali-IP-Country` 必须由实际处理请求的域名（当前域名，或开启目标域名接口后请求的中国域名）的 CDN 或反向代理写入并转发到 Discourse 源站。如果 CDN 没有透传该请求头，接口会返回 `{"country":null}`，前端不会提示。

可以用下面的命令验证：

```bash
curl -s -H 'Ali-IP-Country: CN' \
  https://www.example.com/geo-domain-redirect/country.json
# {"country":"CN"}
```

如果 Discourse 前面还有一层 Nginx，请确保没有清除该请求头。默认情况下 Nginx 会转发客户端请求头；如需显式设置：

```nginx
proxy_set_header Ali-IP-Country $http_ali_ip_country;
```

阿里云 CDN 正常情况下会向源站发送 `Ali-IP-Country`。如果使用了其他 CDN，请把请求头名称改成 CDN 实际发送的名称。

> 请求头由客户端和 CDN 控制，可能被伪造。本插件只用它决定是否展示提示，不用于鉴权或其他安全判断。若 CDN 缓存了 `/geo-domain-redirect/*`，请在 CDN 侧对该路径配置不缓存，或确认 CDN 遵循源站的 `Cache-Control: no-store`。

## 浏览器缓存

忽略规则只保存在当前浏览器：

- `discourse-geo-domain-redirect:snooze`：稍后提醒记录，包含目标域名和过期时间。
- `discourse-geo-domain-redirect:ignore`：永久忽略记录，包含目标域名。

需要重新测试提示时，可以在浏览器开发者工具控制台执行：

```js
localStorage.removeItem("discourse-geo-domain-redirect:snooze");
localStorage.removeItem("discourse-geo-domain-redirect:ignore");
```

然后刷新页面。清除站点数据、使用无痕窗口或更换浏览器也会重新出现提示。

## 测试

在 Discourse 源码目录中执行：

```bash
# Ruby 测试
LOAD_PLUGINS=1 bundle exec rspec plugins/discourse-geo-domain-redirect/spec

# 前端单元测试
bin/qunit plugins/discourse-geo-domain-redirect/test/javascripts/unit/lib/geo-domain-redirect-test.js
```

前端单元测试覆盖域名归一化、跳转地址拼接、国家判断、稍后提醒和永久忽略等纯逻辑。

## 目录结构

```text
app/controllers/discourse_geo_domain_redirect/country_controller.rb  # 国家接口
assets/javascripts/discourse/initializers/geo-domain-redirect.js     # 前端检查入口
assets/javascripts/discourse/components/modal/geo-domain-redirect.gjs # 提示框
assets/javascripts/discourse/lib/geo-domain-redirect.js              # 判断、跳转、缓存逻辑
config/settings.yml                                                   # 站点设置
config/locales/                                                       # 中英文翻译
lib/discourse_geo_domain_redirect/country.rb                          # 请求头解析
spec/                                                                 # RSpec 测试
test/javascripts/                                                     # QUnit 测试
```
