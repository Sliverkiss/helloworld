/*
 * @Author: Sliverkiss
 * @Date: 2023-05-22 22:11:56
 * @homePage: https://github.com/Sliverkiss
 * 
 * 2023-06-15 添加自动收集积点、查询积点余额，优化通知面板，移除U车票小程序签到
 * 
 * @Description:
 * 云闪付每日签到
 * 捉youhui.95516.com域名包下的Authorization,usrId和openId,用#号连接,填写到ysf_cookie中，多账号换行
 * export ysf_cookie="authorization#usrId#openId"
 * 
 * 只用过loon，理论上支持qx、surge，请自行尝试
 * [Script]
 * cron "0 20 9 * * *" script-path=https://raw.githubsercontent.com/Sliverkiss/helloworld/master/Study/ysf.js, timeout=300, tag=云闪付签到 
*/

const $ = new Env("云闪付");
//环境变量名字
const env_name = "ysf_cookie";
const env = $.getdata(env_name);
//通知相关
var message = "";

!(async () => {
    if (typeof $request != "undefined") {
        await getCookie();
        return;
    }
    await main();
})()
    .catch((e) => {
        $.log($.name, `❌失败! 原因: ${e}!`, "");
    })
    .finally(() => {
        $.done();
    });

//脚本入口函数main()
async function main() {
    if (env == '') {
        //没有设置变量,直接退出
        $.msg($.name, "", `没有填写变量: ${env_name}`);
        return;
    }
    //多账号分割,这里默认是换行(\n)分割,其他情况自己实现
    //split('\n')会把字符串按照换行符分割, 并把结果存在user_ck数组里
    let user_ck = env.split('\n');
    let index = 1; //用来给账号标记序号, 从1开始
    //循环遍历每个账号
    for (let ck of user_ck) {
        if (!ck) continue; //跳过空行
        let ck_info = ck.split('#');
        let cookie = ck_info[0];
        let usrId = ck_info[1];
        let openId = ck_info[2];
        //用一个对象代表账号, 里面存放账号信息
        let user = {
            index: index,
            cookie,
            usrId,
            openId //简写法, 效果等同于 openid: openid,
        };
        index = index + 1; //每次用完序号+1
        //开始账号任务
        await userTask(user);
        //每个账号之间等1~5秒随机时间
        let rnd_time = Math.floor(Math.random() * 4000) + 1000;
        console.log(`账号[${user.index}]随机等待${rnd_time / 1000}秒...`);
        await $.wait(rnd_time);
    }
    //发送通知
    notify();
}

async function userTask(user) {
    message += `\n========= 账号[${user.index}]信息 =========`;
    //任务逻辑都放这里了, 与脚本入口分开, 方便分类控制并模块化
    //积分签到
    await signin(user);
    //自动收集积点
    await getPointOnce(user);
    //查询积点余额
    await pointQry(user);
}

function signin(user) {
    return new Promise((resolve) => {
        const header = {
            Accept: '*/*',
            Authorization: user.cookie,
            'Content-Length': 2,
            'Accept-Encoding': 'gzip, deflate, br',
            'Content-Type': 'application/json',
            'Connection': 'keep-alive'
        };
        const signinRequest = {
            url: "https://youhui.95516.com/newsign/api/daily_sign_in",
            headers: header,
        };
        $.post(signinRequest, (error, response, data) => {
            try {
                var result = JSON.parse(data);
                if (result?.signedIn) {
                    message += `\n【积点签到】：成功！已连续签到${result?.signInDays?.days}天`;
                } else {
                    message += `\n【积点签到】：失败！${result?.message}`
                }
            } catch (error) {
                message += `\n🔴${result?.message}`;
                $.logErr(error)
            } finally {
                resolve();
            }
        });
    });
}

//U车票小程序签到(cookie过期太快，以后有空再修)
function uSignin(user) {
    return new Promise((resolve) => {
        const header = {
            "Authorization": " Bearer eyJhbGciOiJIUzUxMiJ9.eyJvcGVuaWQiOiJlL2dUWmFVeFhTNGJGekdYUmZ5TGxKZWthU0ovK3ZVYnQwdWdxR2EyTGVrUkl5d3BwcE9MRjNycU9Vb0hBa2FJIiwibG9naW5fdXNlcl9rZXkiOiJkNjRkYzU0ZC0wMDQ5LTQwMzctYjZmZi1jNTFiZDllYTRlMWIifQ.9Qf728nOoyjkdK4P0r3VgAA-6R3jVVlKbBAJ_0is4duzYGJAI19XQgl3OQYoGBUICBr7v79dDDgifxGygAQ-tg"
        };

        const signinRequest = {
            url: "https://bjchx.95516.com/uhcpmobile/interest/signinInfo/signin",
            headers: header,
        };
        $.post(signinRequest, (error, response, data) => {
            try {
                var result = JSON.parse(data);
                if (result?.code == 200) {
                    message += `\n【U车票小程序】：${result?.data?.rightsLevelCode},距离${result?.data?.rightsLevelName}还需要${result?.data?.rightsLevelIexp}经验值`;
                } else {
                    console.log(data);
                    message += `\n【U车票小程序】：${result?.msg}`
                }
            } catch (error) {
                message += `\n🔴${result?.msg}`;
                $.logErr(error)
            } finally {
                resolve();
            }
        });
    });
}

//自动收积点
function getPointOnce(user) {
    return new Promise((resolve) => {
        const header = {
            "Content-Type": " application/json;charset=UTF-8",
            Authorization: user.cookie
        };
        const params = {
            "cmd": "3008",
            "usrId": user.usrId,
            "h5Flag": "01"
        }
        const signinRequest = {
            url: "https://cloudvip.95516.com/payMember/getPointOnce",
            headers: header,
            body: params
        };
        $.post(signinRequest, (error, response, data) => {
            try {
                var result = JSON.parse(data);
                if (result?.respMsg == "成功" && result?.data?.freshFlag == 0) {
                    message += `\n【收集积点】：成功！获得${result?.data?.allPoint}积点`;
                } else {
                    console.log(data);
                    message += `\n【收集积点】：失败！暂无积点可收集`
                }
            } catch (error) {
                message += `\n🔴${result}`;
                $.logErr(error)
            } finally {
                resolve();
            }
        });
    });
}

//查询积点余额
function pointQry(user) {
    return new Promise((resolve) => {
        const header = {
            "Content-Type": " application/json;charset=UTF-8",
            Authorization: user.cookie
        };
        const params = {
            "cmd": "1001",
            "usrId": user.usrId,
            "openId": user.openId
        }
        const signinRequest = {
            url: "https://cloudvip.95516.com/payMember/pointQry",
            headers: header,
            body: params
        };
        $.post(signinRequest, (error, response, data) => {
            try {
                var result = JSON.parse(data);
                if (result?.respMsg == "成功") {
                    message += `\n【积点余额】：${result?.data?.avlBalance}`;
                } else {
                    console.log(data);
                    message += `\n【积点余额】：${result?.respMsg}`
                }
            } catch (error) {
                message += `\n🔴${result?.message}`;
                $.logErr(error)
            } finally {
                resolve();
            }
        });
    });
}
//获取cookie
async function getCookie() {
    if ($request && $request.method != "OPTIONS" && $request.url.match(/\/daily_sign_in\//)) {
        const cookie = $request.headers['Authorization'] || $request.headers['authorization'];
        $.setdata(cookie.env_name);
        $.msg($.name, '🟢获取会话成功', '');
    }
}

//通知函数
async function notify() {
    $.msg($.name, "", message);
}




/** ---------------------------------固定不动区域----------------------------------------- */

//From chavyleung's Env.js
function Env(name, opts) {
    class Http {
        constructor(env) {
            this.env = env;
        }

        send(opts, method = "GET") {
            opts = typeof opts === "string" ? { url: opts } : opts;
            let sender = this.get;
            if (method === "POST") {
                sender = this.post;
            }
            return new Promise((resolve, reject) => {
                sender.call(this, opts, (err, resp, body) => {
                    if (err) reject(err);
                    else resolve(resp);
                });
            });
        }

        get(opts) {
            return this.send.call(this.env, opts);
        }

        post(opts) {
            return this.send.call(this.env, opts, "POST");
        }
    }

    return new (class {
        constructor(name, opts) {
            this.name = name;
            this.http = new Http(this);
            this.data = null;
            this.dataFile = "box.dat";
            this.logs = [];
            this.isMute = false;
            this.isNeedRewrite = false;
            this.logSeparator = "\n";
            this.startTime = new Date().getTime();
            Object.assign(this, opts);
            this.log("", `🔔${this.name}, 开始!`);
        }

        isNode() {
            return "undefined" !== typeof module && !!module.exports;
        }

        isQuanX() {
            return "undefined" !== typeof $task;
        }

        isSurge() {
            return "undefined" !== typeof $httpClient && "undefined" === typeof $loon;
        }

        isLoon() {
            return "undefined" !== typeof $loon;
        }

        toObj(str, defaultValue = null) {
            try {
                return JSON.parse(str);
            } catch {
                return defaultValue;
            }
        }

        toStr(obj, defaultValue = null) {
            try {
                return JSON.stringify(obj);
            } catch {
                return defaultValue;
            }
        }

        getjson(key, defaultValue) {
            let json = defaultValue;
            const val = this.getdata(key);
            if (val) {
                try {
                    json = JSON.parse(this.getdata(key));
                } catch { }
            }
            return json;
        }

        setjson(val, key) {
            try {
                return this.setdata(JSON.stringify(val), key);
            } catch {
                return false;
            }
        }

        getScript(url) {
            return new Promise((resolve) => {
                this.get({ url }, (err, resp, body) => resolve(body));
            });
        }

        runScript(script, runOpts) {
            return new Promise((resolve) => {
                let httpapi = this.getdata("@chavy_boxjs_userCfgs.httpapi");
                httpapi = httpapi ? httpapi.replace(/\n/g, "").trim() : httpapi;
                let httpapi_timeout = this.getdata(
                    "@chavy_boxjs_userCfgs.httpapi_timeout"
                );
                httpapi_timeout = httpapi_timeout ? httpapi_timeout * 1 : 20;
                httpapi_timeout =
                    runOpts && runOpts.timeout ? runOpts.timeout : httpapi_timeout;
                const [key, addr] = httpapi.split("@");
                const opts = {
                    url: `http://${addr}/v1/scripting/evaluate`,
                    body: {
                        script_text: script,
                        mock_type: "cron",
                        timeout: httpapi_timeout,
                    },
                    headers: { "X-Key": key, Accept: "*/*" },
                };
                this.post(opts, (err, resp, body) => resolve(body));
            }).catch((e) => this.logErr(e));
        }

        loaddata() {
            if (this.isNode()) {
                this.fs = this.fs ? this.fs : require("fs");
                this.path = this.path ? this.path : require("path");
                const curDirDataFilePath = this.path.resolve(this.dataFile);
                const rootDirDataFilePath = this.path.resolve(
                    process.cwd(),
                    this.dataFile
                );
                const isCurDirDataFile = this.fs.existsSync(curDirDataFilePath);
                const isRootDirDataFile =
                    !isCurDirDataFile && this.fs.existsSync(rootDirDataFilePath);
                if (isCurDirDataFile || isRootDirDataFile) {
                    const datPath = isCurDirDataFile
                        ? curDirDataFilePath
                        : rootDirDataFilePath;
                    try {
                        return JSON.parse(this.fs.readFileSync(datPath));
                    } catch (e) {
                        return {};
                    }
                } else return {};
            } else return {};
        }

        writedata() {
            if (this.isNode()) {
                this.fs = this.fs ? this.fs : require("fs");
                this.path = this.path ? this.path : require("path");
                const curDirDataFilePath = this.path.resolve(this.dataFile);
                const rootDirDataFilePath = this.path.resolve(
                    process.cwd(),
                    this.dataFile
                );
                const isCurDirDataFile = this.fs.existsSync(curDirDataFilePath);
                const isRootDirDataFile =
                    !isCurDirDataFile && this.fs.existsSync(rootDirDataFilePath);
                const jsondata = JSON.stringify(this.data);
                if (isCurDirDataFile) {
                    this.fs.writeFileSync(curDirDataFilePath, jsondata);
                } else if (isRootDirDataFile) {
                    this.fs.writeFileSync(rootDirDataFilePath, jsondata);
                } else {
                    this.fs.writeFileSync(curDirDataFilePath, jsondata);
                }
            }
        }

        lodash_get(source, path, defaultValue = undefined) {
            const paths = path.replace(/\[(\d+)\]/g, ".$1").split(".");
            let result = source;
            for (const p of paths) {
                result = Object(result)[p];
                if (result === undefined) {
                    return defaultValue;
                }
            }
            return result;
        }

        lodash_set(obj, path, value) {
            if (Object(obj) !== obj) return obj;
            if (!Array.isArray(path)) path = path.toString().match(/[^.[\]]+/g) || [];
            path
                .slice(0, -1)
                .reduce(
                    (a, c, i) =>
                        Object(a[c]) === a[c]
                            ? a[c]
                            : (a[c] = Math.abs(path[i + 1]) >> 0 === +path[i + 1] ? [] : {}),
                    obj
                )[path[path.length - 1]] = value;
            return obj;
        }

        getdata(key) {
            let val = this.getval(key);
            // 如果以 @
            if (/^@/.test(key)) {
                const [, objkey, paths] = /^@(.*?)\.(.*?)$/.exec(key);
                const objval = objkey ? this.getval(objkey) : "";
                if (objval) {
                    try {
                        const objedval = JSON.parse(objval);
                        val = objedval ? this.lodash_get(objedval, paths, "") : val;
                    } catch (e) {
                        val = "";
                    }
                }
            }
            return val;
        }

        setdata(val, key) {
            let issuc = false;
            if (/^@/.test(key)) {
                const [, objkey, paths] = /^@(.*?)\.(.*?)$/.exec(key);
                const objdat = this.getval(objkey);
                const objval = objkey
                    ? objdat === "null"
                        ? null
                        : objdat || "{}"
                    : "{}";
                try {
                    const objedval = JSON.parse(objval);
                    this.lodash_set(objedval, paths, val);
                    issuc = this.setval(JSON.stringify(objedval), objkey);
                } catch (e) {
                    const objedval = {};
                    this.lodash_set(objedval, paths, val);
                    issuc = this.setval(JSON.stringify(objedval), objkey);
                }
            } else {
                issuc = this.setval(val, key);
            }
            return issuc;
        }

        getval(key) {
            if (this.isSurge() || this.isLoon()) {
                return $persistentStore.read(key);
            } else if (this.isQuanX()) {
                return $prefs.valueForKey(key);
            } else if (this.isNode()) {
                this.data = this.loaddata();
                return this.data[key];
            } else {
                return (this.data && this.data[key]) || null;
            }
        }

        setval(val, key) {
            if (this.isSurge() || this.isLoon()) {
                return $persistentStore.write(val, key);
            } else if (this.isQuanX()) {
                return $prefs.setValueForKey(val, key);
            } else if (this.isNode()) {
                this.data = this.loaddata();
                this.data[key] = val;
                this.writedata();
                return true;
            } else {
                return (this.data && this.data[key]) || null;
            }
        }

        initGotEnv(opts) {
            this.got = this.got ? this.got : require("got");
            this.cktough = this.cktough ? this.cktough : require("tough-cookie");
            this.ckjar = this.ckjar ? this.ckjar : new this.cktough.CookieJar();
            if (opts) {
                opts.headers = opts.headers ? opts.headers : {};
                if (undefined === opts.headers.Cookie && undefined === opts.cookieJar) {
                    opts.cookieJar = this.ckjar;
                }
            }
        }

        get(opts, callback = () => { }) {
            if (opts.headers) {
                delete opts.headers["Content-Type"];
                delete opts.headers["Content-Length"];
            }
            if (this.isSurge() || this.isLoon()) {
                if (this.isSurge() && this.isNeedRewrite) {
                    opts.headers = opts.headers || {};
                    Object.assign(opts.headers, { "X-Surge-Skip-Scripting": false });
                }
                $httpClient.get(opts, (err, resp, body) => {
                    if (!err && resp) {
                        resp.body = body;
                        resp.statusCode = resp.status;
                    }
                    callback(err, resp, body);
                });
            } else if (this.isQuanX()) {
                if (this.isNeedRewrite) {
                    opts.opts = opts.opts || {};
                    Object.assign(opts.opts, { hints: false });
                }
                $task.fetch(opts).then(
                    (resp) => {
                        const { statusCode: status, statusCode, headers, body } = resp;
                        callback(null, { status, statusCode, headers, body }, body);
                    },
                    (err) => callback(err)
                );
            } else if (this.isNode()) {
                this.initGotEnv(opts);
                this.got(opts)
                    .on("redirect", (resp, nextOpts) => {
                        try {
                            if (resp.headers["set-cookie"]) {
                                const ck = resp.headers["set-cookie"]
                                    .map(this.cktough.Cookie.parse)
                                    .toString();
                                if (ck) {
                                    this.ckjar.setCookieSync(ck, null);
                                }
                                nextOpts.cookieJar = this.ckjar;
                            }
                        } catch (e) {
                            this.logErr(e);
                        }
                        // this.ckjar.setCookieSync(resp.headers['set-cookie'].map(Cookie.parse).toString())
                    })
                    .then(
                        (resp) => {
                            const { statusCode: status, statusCode, headers, body } = resp;
                            callback(null, { status, statusCode, headers, body }, body);
                        },
                        (err) => {
                            const { message: error, response: resp } = err;
                            callback(error, resp, resp && resp.body);
                        }
                    );
            }
        }

        post(opts, callback = () => { }) {
            // 如果指定了请求体, 但没指定`Content-Type`, 则自动生成
            if (opts.body && opts.headers && !opts.headers["Content-Type"]) {
                opts.headers["Content-Type"] = "application/x-www-form-urlencoded";
            }
            if (opts.headers) delete opts.headers["Content-Length"];
            if (this.isSurge() || this.isLoon()) {
                if (this.isSurge() && this.isNeedRewrite) {
                    opts.headers = opts.headers || {};
                    Object.assign(opts.headers, { "X-Surge-Skip-Scripting": false });
                }
                $httpClient.post(opts, (err, resp, body) => {
                    if (!err && resp) {
                        resp.body = body;
                        resp.statusCode = resp.status;
                    }
                    callback(err, resp, body);
                });
            } else if (this.isQuanX()) {
                opts.method = "POST";
                if (this.isNeedRewrite) {
                    opts.opts = opts.opts || {};
                    Object.assign(opts.opts, { hints: false });
                }
                $task.fetch(opts).then(
                    (resp) => {
                        const { statusCode: status, statusCode, headers, body } = resp;
                        callback(null, { status, statusCode, headers, body }, body);
                    },
                    (err) => callback(err)
                );
            } else if (this.isNode()) {
                this.initGotEnv(opts);
                const { url, ..._opts } = opts;
                this.got.post(url, _opts).then(
                    (resp) => {
                        const { statusCode: status, statusCode, headers, body } = resp;
                        callback(null, { status, statusCode, headers, body }, body);
                    },
                    (err) => {
                        const { message: error, response: resp } = err;
                        callback(error, resp, resp && resp.body);
                    }
                );
            }
        }
        /**
         *
         * 示例:$.time('yyyy-MM-dd qq HH:mm:ss.S')
         *    :$.time('yyyyMMddHHmmssS')
         *    y:年 M:月 d:日 q:季 H:时 m:分 s:秒 S:毫秒
         *    其中y可选0-4位占位符、S可选0-1位占位符，其余可选0-2位占位符
         * @param {string} fmt 格式化参数
         * @param {number} 可选: 根据指定时间戳返回格式化日期
         *
         */
        time(fmt, ts = null) {
            const date = ts ? new Date(ts) : new Date();
            let o = {
                "M+": date.getMonth() + 1,
                "d+": date.getDate(),
                "H+": date.getHours(),
                "m+": date.getMinutes(),
                "s+": date.getSeconds(),
                "q+": Math.floor((date.getMonth() + 3) / 3),
                S: date.getMilliseconds(),
            };
            if (/(y+)/.test(fmt))
                fmt = fmt.replace(
                    RegExp.$1,
                    (date.getFullYear() + "").substr(4 - RegExp.$1.length)
                );
            for (let k in o)
                if (new RegExp("(" + k + ")").test(fmt))
                    fmt = fmt.replace(
                        RegExp.$1,
                        RegExp.$1.length == 1
                            ? o[k]
                            : ("00" + o[k]).substr(("" + o[k]).length)
                    );
            return fmt;
        }

        /**
         * 系统通知
         *
         * > 通知参数: 同时支持 QuanX 和 Loon 两种格式, EnvJs根据运行环境自动转换, Surge 环境不支持多媒体通知
         *
         * 示例:
         * $.msg(title, subt, desc, 'twitter://')
         * $.msg(title, subt, desc, { 'open-url': 'twitter://', 'media-url': 'https://github.githubassets.com/images/modules/open_graph/github-mark.png' })
         * $.msg(title, subt, desc, { 'open-url': 'https://bing.com', 'media-url': 'https://github.githubassets.com/images/modules/open_graph/github-mark.png' })
         *
         * @param {*} title 标题
         * @param {*} subt 副标题
         * @param {*} desc 通知详情
         * @param {*} opts 通知参数
         *
         */
        msg(title = name, subt = "", desc = "", opts) {
            const toEnvOpts = (rawopts) => {
                if (!rawopts) return rawopts;
                if (typeof rawopts === "string") {
                    if (this.isLoon()) return rawopts;
                    else if (this.isQuanX()) return { "open-url": rawopts };
                    else if (this.isSurge()) return { url: rawopts };
                    else return undefined;
                } else if (typeof rawopts === "object") {
                    if (this.isLoon()) {
                        let openUrl = rawopts.openUrl || rawopts.url || rawopts["open-url"];
                        let mediaUrl = rawopts.mediaUrl || rawopts["media-url"];
                        return { openUrl, mediaUrl };
                    } else if (this.isQuanX()) {
                        let openUrl = rawopts["open-url"] || rawopts.url || rawopts.openUrl;
                        let mediaUrl = rawopts["media-url"] || rawopts.mediaUrl;
                        return { "open-url": openUrl, "media-url": mediaUrl };
                    } else if (this.isSurge()) {
                        let openUrl = rawopts.url || rawopts.openUrl || rawopts["open-url"];
                        return { url: openUrl };
                    }
                } else {
                    return undefined;
                }
            };
            if (!this.isMute) {
                if (this.isSurge() || this.isLoon()) {
                    $notification.post(title, subt, desc, toEnvOpts(opts));
                } else if (this.isQuanX()) {
                    $notify(title, subt, desc, toEnvOpts(opts));
                }
            }
            if (!this.isMuteLog) {
                let logs = ["", "==============📣系统通知📣=============="];
                logs.push(title);
                subt ? logs.push(subt) : "";
                desc ? logs.push(desc) : "";
                console.log(logs.join("\n"));
                this.logs = this.logs.concat(logs);
            }
        }

        log(...logs) {
            if (logs.length > 0) {
                this.logs = [...this.logs, ...logs];
            }
            console.log(logs.join(this.logSeparator));
        }

        logErr(err, msg) {
            const isPrintSack = !this.isSurge() && !this.isQuanX() && !this.isLoon();
            if (!isPrintSack) {
                this.log("", `❗️${this.name}, 错误!`, err);
            } else {
                this.log("", `❗️${this.name}, 错误!`, err.stack);
            }
        }

        wait(time) {
            return new Promise((resolve) => setTimeout(resolve, time));
        }

        done(val = {}) {
            const endTime = new Date().getTime();
            const costTime = (endTime - this.startTime) / 1000;
            this.log("", `🔔${this.name}, 结束! 🕛 ${costTime} 秒`);
            this.log();
            if (this.isSurge() || this.isQuanX() || this.isLoon()) {
                $done(val);
            }
        }
    })(name, opts);
}
