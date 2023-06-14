/*
 * @Author: Sliverkiss
 * @Date: 2023-05-16 18:30:27
 * @homepage: https://github.com/Sliverkiss
 * 
 * 2023-06-08 修复评论转发任务bug 
 * 2023-06-14 增加寻找米其林先生任务、查询积分余额，优化通知排版
 *
 * @Description:
 * 微信小程序 米其林会员俱乐部 v2.0.1 每月能跑积分1500+ 积分兑换实物
 * 捉ulp.michelin.com.cn域名任意包下的Authorization,填写到michelin_data中，多账号用#号连接
 * 
 * 只用过loon，理论上支持qx、surge，请自行尝试,不支持青龙
 * 重写：打开微信小程序,点击探索+获取
 * [Script]
 * cron "0 15 13 * * 1" script-path=https://raw.githubsercontent.com/Sliverkiss/helloworld/master/Study/michelin.js, timeout=300, tag=米其林会员俱乐部
 * http-request ^https?:\/\/ulp\.michelin\.com\.cn\/op\/.+ script-path=https://raw.githubsercontent.com/Sliverkiss/helloworld/master/Study/michelin.cookie.js, timeout=10, tag=米其林俱乐部token
 *
 * [Mitm]
 *  hostname=ulp.michelin.com.cn 
 * 
 */
 
const $ = new Env("米其林会员俱乐部");
const env_name = "michelin_data";
const env = $.getdata(env_name)
//通知相关
var message = "";

var stdAnswers;
var questionList;
var questionNo;
!(async () => {
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
        let authorization = ck_info[0];
        //用一个对象代表账号, 里面存放账号信息
        let user = {
            index: index,
            authorization
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
    //任务逻辑都放这里了, 与脚本入口分开, 方便分类控制并模块化
    console.log(`\n========= 账号[${user.index}]信息 =========`)
    message += `\n========= 账号[${user.index}]信息 =========`;
    //获取本期问卷
    await getPaper(user);
    //回答问卷题目
    await getOpenTpaper(user);
    //提交调查问卷
    await paperScore(user);
    //评论/转发任务
    await pointsToast(user);
    //寻找米其林先生任务
    await luckyDrawTask(user);
    //查询用户积分余额
    await getPoints(user);

}

//获取本期调查问卷接口
async function getPaper(user) {
    return new Promise((resolve) => {
        const header = {
            Authorization: user.authorization
        };
        const signinRequest = {
            url: "https://ulp.michelin.com.cn/campaign/paper/user",
            headers: header,
            body: "{\n\n}"
        };
        $.post(signinRequest, (error, response, data) => {
            try {
                var body = response.body;
                var result = JSON.parse(body);
                if (result?.code == 200) {
                    $.log(`帐号[${user.index}]本次调查问卷为${result?.data?.npsPaperCode}，总共${result?.data?.questionNum}道题目,状态为${result?.data?.status}`);
                    //获取本期问卷期数
                    $.npsPaperCode = result?.data?.npsPaperCode;
                    //获取本期问卷验证编号
                    $.paperCode = result?.data?.paperCode;
                } else {
                    message += `\n帐号[${user.index}]本次调查问卷获取失败！${result?.message}`
                }
            } catch (error) {
                $.log(error)
            } finally {
                resolve();
            }
        });
    });
}
//问卷题目接口
async function getOpenTpaper(user) {
    console.log("开始尝试获取问卷列表...")
    return new Promise((resolve) => {
        const header = {
            Authorization: user.authorization,
        };
        const signinRequest = {
            url: `https://ulp.michelin.com.cn/npspaper/nps-admin/open/api/cp/public/get_open_tpaper/${$.npsPaperCode}`,
            headers: header,
        };
        $.get(signinRequest, async (error, response, data) => {
            try {
                var body = response.body;
                var result = JSON.parse(body);
                if (result?.success) {
                    $.log("获取问卷列表成功，开始依次回答问题......");
                    stdAnswers = result?.data?.stdAnswers;
                    questionList = result?.data?.questionList;
                    //记录当前问题序号
                    questionNo = 1;
                    //依次回答问题列表中的问题
                    for (let question of questionList) {
                        //开始回答问题
                        await answer(user, question, stdAnswers);
                        //每个账号之间等1~5秒随机时间
                        let rnd_time = Math.floor(Math.random() * 4000) + 1000;
                        await $.wait(rnd_time);
                    }
                    $.log(`帐号[${user.index}]结束问卷问题！`)
                } else {
                    message += `\n🔴帐号[${user.index}]获取问卷列表失败！${result?.message}`
                }
            } catch (e) {
                console.log(e);
            } finally {
                resolve();
            }
        });
    });
}

//回答问题接口
async function answer(user, question, stdAnswerList) {
    $.log(`正在回答问题...`)
    let theQuestion;
    let theAnswer;
    //每个问题之间等1~5秒随机时间
    let rnd_time = Math.floor(Math.random() * 4000) + 1000;
    await $.wait(rnd_time);
    //从答案列表中找出当前问题答案
    for (let answer of stdAnswerList) {
        if (questionNo != 3) {
            if (question.questionChoise.npsQuestionPk == answer.npsQuestionChoisePk) {
                //当前问题
                theQuestion = answer.npsQuestionChoisePk;
                //当前问题答案
                theAnswer = answer.npsQuestionChoiseOptionPk;
                questionNo++;
                //跳出循环
                break;
            }
            //最后一道题为开放题，答案列表中没有，默认选择第一项
        } else {
            theQuestion = question.questionChoise.npsQuestionPk;
            theAnswer = question.questionChoise.options[0].npsQuestionChoiseOptionPk;
        }
    }
    return new Promise((resolve) => {
        const header = {
            Authorization: user.authorization,
            "content-type": "application/json",
        };
        const params = {
            answerOptionId: [`${theAnswer}`],
            paperCode: $.paperCode,
            questionId: theQuestion
        }
        const signinRequest = {
            url: "https://ulp.michelin.com.cn/campaign/paper/user/answer",
            headers: header,
            body: params
        };
        $.post(signinRequest, (error, response, data) => {
            try {
                var body = response.body;
                var result = JSON.parse(body);
                if (result?.code == 200) {
                    $.log(`帐号[${user.index}]问题回答成功！`);
                } else {
                    $.log(`\n帐号[${user.index}]问题回答失败！${result?.message}`);
                }
            } catch (e) {
                console.log(e);
            } finally {
                resolve();
            }
        });
    });
}

//提交问卷接口
async function paperScore(user) {
    return new Promise((resolve) => {
        const header = {
            Authorization: user.authorization,
            "content-type": "application/json",
        };
        const signinRequest = {
            url: `https://ulp.michelin.com.cn/campaign/paper/score/${$.paperCode}`,
            headers: header,
            body: "{\n    \n}"
        };
        $.post(signinRequest, (error, response, data) => {
            try {
                var body = response.body;
                var result = JSON.parse(body);
                if (result?.code == 200) {
                    message += `\n【答题任务】：获得${result?.data?.score}积分,排名${result?.data?.rank}`;
                } else {
                    message += `\n【答题状态】：${result?.message}`
                }
            } catch (e) {
                console.log(e);
            } finally {
                resolve();
            }
        });
    });
}

//重复转发10次
async function pointsToast(user) {
    for (let i = 1; i <= 10; i++) {
        $.log(`正在执行第${i}次转发...`)
        share(user);
        //每次转发之间等1~5秒随机时间
        let rnd_time = Math.floor(Math.random() * 4000) + 1000;
        await $.wait(rnd_time);
    }
    message+=`\n【评论/转发任务】：详情请查看日志`
}

//分享转发任务接口
async function share(user) {
    return new Promise((resolve) => {
        const header = {
            Authorization: user.authorization,
            "content-type": "application/json"
        };
        const params={
            type: "ARTICLE",
            code: "COM-TXS-38"
        }
        const signinRequest = {
            url: `https://ulp.michelin.com.cn/op/points/share/have`,
            headers: header,
            body: params
        };
        $.post(signinRequest, (error, response, data) => {
            try {
                var body = response.body;
                var result = JSON.parse(body);
                if (result?.code == 200) {
                    $.log(`帐号[${user.index}]转发成功！`)
                } else {
                    message += `\n帐号[${user.index}]转发失败！${result?.message}`
                }
            } catch (e) {
                console.log(e);
            } finally {
                resolve();
            }
        });
    });
}

//重复20次
async function luckyDrawTask(user) {
    for (let i = 1; i <= 20; i++) {
        $.log(`正在执行第${i}次扫码...`)
        luckyDraw(user);
        //每次转发之间等1~5秒随机时间
        let rnd_time = Math.floor(Math.random() * 4000) + 1000;
        await $.wait(rnd_time);
    }
    message+=`\n【寻找米其林】：详情请查看日志`
}

//寻找米其林任务接口
async function luckyDraw(user) {
    return new Promise((resolve) => {
        const header = {
            Authorization: user.authorization
        };
        const signinRequest = {
            url: `https://ulp.michelin.com.cn/campaign/stage/luckydraw/BIB_2022`,
            headers: header,
        };
        $.get(signinRequest, (error, response, data) => {
            try {
                var body = response.body;
                var result = JSON.parse(body);
                if (result?.code == 200) {
                    $.log(`扫码成功！获得${result?.data?.name}`)
                } else {
                    message += `\n帐号[${user.index}]扫码失败！${result}`
                }
            } catch (error) {
                $.log(error)
            } finally {
                resolve();
            }
        });
    });
}

//查询用户积分接口
async function getPoints(user) {
    return new Promise((resolve) => {
        const header = {
            Authorization: user.authorization
        };
        const signinRequest = {
            url: `https://ulp.michelin.com.cn/bff/profile`,
            headers: header,
        };
        $.get(signinRequest, (error, response, data) => {
            try {
                var body = response.body;
                var result = JSON.parse(body);
                if (result?.code == 200) {
                    message+=`\n【积分余额】：${result?.data?.points}`
                } else {
                    message += `\n【积分余额】：${result?.message}`
                }
            } catch (error) {
                $.log(error)
            } finally {
                resolve();
            }
        });
    });
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
