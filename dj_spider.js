/**
 * OmniBox / 蜘蛛聚合系统 - 多源短剧标准脚本 (CommonJS)
 * 聚合了：低端影视(短剧版) + 短剧好看
 */

const axios = require('axios');

const HOST_DIDUAN = "https://diduan3.com";
const HOST_HAOKAN = "http://duanjuhk.com";
const UA = "Mozilla/5.0 (Linux; Android 10; Mobile)";

// 辅助工具：字符串截取
function ctxString(str, startStr, endStr) {
    let startIndex = str.indexOf(startStr);
    if (startIndex === -1) return "";
    startIndex += startStr.length;
    let endIndex = str.indexOf(endStr, startIndex);
    if (endIndex === -1) return "";
    return str.substring(startIndex, endIndex);
}

/**
 * 1. 首页初始化 (组合两个站的分类，使用前缀区分)
 */
async function home(filter) {
    try {
        const classes = [
            // 低端影视短剧分类
            { "type_id": "dd_guzhuang", "type_name": "低端·古装" },
            { "type_id": "dd_nielian", "type_name": "低端·虐恋" },
            { "type_id": "dd_nixi", "type_name": "低端·逆袭" },
            { "type_id": "dd_zongcai", "type_name": "低端·总裁" },
            // 短剧好看分类
            { "type_id": "hk_jingxuan", "type_name": "好看·精选" },
            { "type_id": "hk_dushi", "type_name": "好看·都市" },
            { "type_id": "hk_chuanyue", "type_name": "好看·穿越" }
        ];
        return JSON.stringify({ class: classes, filters: {} });
    } catch (e) {
        return JSON.stringify({ class: [] });
    }
}

/**
 * 2. 分类页面数据获取
 */
async function category(tid, pg, filter, extend) {
    try {
        const page = pg || 1;
        const list = [];

        // 分流处理：如果是低端影视的分类
        if (tid.startsWith("dd_")) {
            const cateMap = { "dd_guzhuang": "古装", "dd_nielian": "虐恋", "dd_nixi": "逆袭", "dd_zongcai": "总裁" };
            const tag = encodeURIComponent(cateMap[tid] || "古装");
            // 拼接低端影视筛选URL
            const url = `${HOST_DIDUAN}/show-duanju---${tag}-------${page}---/`;
            const res = await axios.get(url, { headers: { "User-Agent": UA } });
            const html = res.data;
            
            const blockReg = /<div class="module-item">([\s\(\S\)]*?)<\/div>\s*<\/div>/g;
            let match;
            while ((match = blockReg.exec(html)) !== null) {
                const content = match[1];
                const id = ctxString(content, 'href="/video/', '.html"');
                const name = ctxString(content, 'title="', '"');
                const pic = ctxString(content, 'data-original="', '"');
                const remarks = ctxString(content, 'module-item-note">', '</div>');
                
                if(id) {
                    list.push({
                        vod_id: "dd_" + id,
                        vod_name: "[低端] " + name,
                        vod_pic: pic,
                        vod_remarks: remarks.replace(/<[^>]+>/g, '').trim()
                    });
                }
            }
        } 
        // 分流处理：如果是短剧好看的分类
        else if (tid.startsWith("hk_")) {
            const cateMap = { "hk_jingxuan": "jingxuanduanju", "hk_dushi": "dushi", "hk_chuanyue": "chuanyue" };
            const cateId = cateMap[tid];
            const url = `${HOST_HAOKAN}/vodshow/id/${cateId}/letter//page/${page}.html`;
            const res = await axios.get(url, { headers: { "User-Agent": UA } });
            const html = res.data;

            const blockReg = /<a[^>]*href="\/voddetail\/([^.]+)\.html"[^>]*>([\s\(\S\)]*?)<\/a>/g;
            let match;
            while ((match = blockReg.exec(html)) !== null) {
                const id = match[1];
                const content = match[2];
                const name = ctxString(content, 'title="', '"') || ctxString(content, 'alt="', '"');
                const pic = ctxString(content, 'data-original="', '"') || ctxString(content, 'src="', '"');
                
                if(id) {
                    list.push({
                        vod_id: "hk_" + id,
                        vod_name: "[好看] " + name,
                        vod_pic: pic.startsWith('http') ? pic : HOST_HAOKAN + pic,
                        vod_remarks: "高清短剧"
                    });
                }
            }
        }

        return JSON.stringify({ page: parseInt(page), pagecount: 99, limit: 20, total: 1980, list: list });
    } catch (e) {
        return JSON.stringify({ list: [] });
    }
}

/**
 * 3. 详情页与选集提取
 */
async function detail(id) {
    try {
        let playListArray = [];
        let name = "短剧详情", pic = "", desc = "";
        let originId = id.substring(3);

        if (id.startsWith("dd_")) {
            const url = `${HOST_DIDUAN}/video/${originId}.html`;
            const res = await axios.get(url, { headers: { "User-Agent": UA } });
            const html = res.data;
            name = ctxString(html, '<h1>', '</h1>') || "低端短剧";
            pic = ctxString(html, 'class="module-item-pic"><img src="', '"');
            desc = ctxString(html, 'module-info-introduction-content">', '</div>');

            const epReg = /<a[^>]*href="\/play\/([^\.]+)\.html"[^>]*><span>([^<]+)<\/span>/g;
            let match;
            while ((match = epReg.exec(html)) !== null) {
                playListArray.push(`${match[2].trim()}$dd_${match[1]}`);
            }
        } else if (id.startsWith("hk_")) {
            const url = `${HOST_HAOKAN}/voddetail/${originId}.html`;
            const res = await axios.get(url, { headers: { "User-Agent": UA } });
            const html = res.data;
            name = ctxString(html, '<h1>', '</h1>') || "好看短剧";
            pic = ctxString(html, 'class="vod-pic"><img src="', '"');
            desc = ctxString(html, '简介：', '</li>');

            const epReg = /<a[^>]*href="\/vodplay\/([^.]+)\.html"[^>]*>([^<]+)<\/a>/g;
            let match;
            while ((match = epReg.exec(html)) !== null) {
                playListArray.push(`${match[2].trim()}$hk_${match[1]}`);
            }
        }

        return JSON.stringify({
            list: [{
                vod_id: id,
                vod_name: name,
                vod_pic: pic,
                vod_content: desc.replace(/<[^>]+>/g, '').trim() || "暂无简介",
                vod_play_from: "多源短剧流",
                vod_play_url: playListArray.join('#')
            }]
        });
    } catch (e) {
        return JSON.stringify({ list: [] });
    }
}

/**
 * 4. 搜索功能 (同时搜两个站)
 */
async function search(wd, quick) {
    try {
        const list = [];
        // 简单实现单站搜索（以短剧好看为例，避免多异步请求在部分壳里超时）
        const url = `${HOST_HAOKAN}/vodsearch/page/1/wd/${encodeURIComponent(wd)}.html`;
        const res = await axios.get(url, { headers: { "User-Agent": UA } });
        const html = res.data;

        const searchReg = /<a[^>]*href="\/voddetail\/([^.]+)\.html"[^>]*>([\s\(\S\)]*?)<\/a>/g;
        let match;
        while ((match = searchReg.exec(html)) !== null) {
            const id = match[1];
            const content = match[2];
            const name = ctxString(content, 'title="', '"');
            const pic = ctxString(content, 'data-original="', '"');
            list.push({
                vod_id: "hk_" + id,
                vod_name: "[搜索] " + name,
                vod_pic: pic.startsWith('http') ? pic : HOST_HAOKAN + pic,
                vod_remarks: "点击播放"
            });
        }
        return JSON.stringify({ list: list });
    } catch (e) {
        return JSON.stringify({ list: [] });
    }
}

/**
 * 5. 播放解析
 */
async function play(flag, id, flags) {
    try {
        let videoUrl = "";
        let originPlayId = id.substring(3);

        if (id.startsWith("dd_")) {
            const url = `${HOST_DIDUAN}/play/${originPlayId}.html`;
            const res = await axios.get(url, { headers: { "User-Agent": UA } });
            const urlMatch = res.data.match(/"url"\s*:\s*"([^"]+)"/);
            if (urlMatch && urlMatch[1]) {
                videoUrl = decodeURIComponent(urlMatch[1]).replace(/\\/g, '');
                if(videoUrl.includes("url=")) videoUrl = videoUrl.split("url=")[1];
            }
        } else if (id.startsWith("hk_")) {
            const url = `${HOST_HAOKAN}/vodplay/${originPlayId}.html`;
            const res = await axios.get(url, { headers: { "User-Agent": UA } });
            const urlMatch = res.data.match(/"url"\s*:\s*"([^"]+)"/);
            if (urlMatch && urlMatch[1]) {
                videoUrl = urlMatch[1].replace(/\\/g, '');
            }
        }

        return JSON.stringify({ parse: 0, url: videoUrl, header: { "User-Agent": UA } });
    } catch (e) {
        return JSON.stringify({ parse: 0, url: "" });
    }
}

module.exports = { home, category, detail, search, play };
