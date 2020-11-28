// ==UserScript==
// @name         ehx direct download
// @namespace    https://github.com/x94fujo6rpg/SomeTampermonkeyScripts
// @updateURL    https://github.com/x94fujo6rpg/SomeTampermonkeyScripts/raw/master/ehx_direct_download.user.js
// @downloadURL  https://github.com/x94fujo6rpg/SomeTampermonkeyScripts/raw/master/ehx_direct_download.user.js
// @version      0.76
// @description  direct download archive from list / sort gallery (in current page) / show full title in pure text
// @author       x94fujo6
// @match        https://e-hentai.org/*
// @exclude      https://e-hentai.org/mytags
// @exclude      https://e-hentai.org/mpv/*
// @match        https://exhentai.org/*
// @exclude      https://exhentai.org/mytags
// @exclude      https://exhentai.org/mpv/*
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

// this script only work in Thumbnail mode

(function () {
    'use strict';
    let api;
    let domain;
    let hid = true;
    let m = "[ehx direct download]: ";
    let debug_message = true;
    let debug_adv = false;
    let gallery_nodes;
    let gdata = [];
    let gcount = 0;
    let pcount = 0;
    let timer_list = [];
    let key_list = {
        dl_list: "exhddl_list",
        sort_setting: "exhddl_sortsetting",
        dl_and_copy: "exhddl_dl_and_copy",
        auto_fix_title: "exhddl_auto_fix_title",
    };
    let default_value = {
        dl_list: [],
        sort_setting: true,
        dl_and_copy: true,
        auto_fix_title: true,
    };
    let id_list = {
        mainbox: "exhddl_activate",
        dd: "exhddl_ddbutton",
        puretext: "exhddl_puretext",
        sort_setting: "exhddl_sortsetting",
        jump_to_last: "exhddl_jump_to_last",
        dl_and_copy: "exhddl_dl_and_copy",
        auto_fix_title: "exhddl_auto_fix_title",
    };
    let style_list = {
        top_button: { width: "max-content" },
        gallery_button: { width: "max-content", alignSelf: "center" },
        gallery_marked: { backgroundColor: "black" },
        button_marked: { color: "gray", backgroundColor: "transparent" },
        ex: { opacity: 0.3 },
    };
    let status_update_interval = 500;
    let prefix_fixed = false;
    let ignore_prefix = [
        "(同人誌)",
        "(成年コミック)",
        "(成年コミック・雑誌)",
        "(一般コミック)",
        "(一般コミック・雑誌)",
        "(エロライトノベル)",
        "(ゲームCG)",
        "(同人ゲームCG)",
        "(18禁ゲームCG)",
    ];

    window.onload = main();

    function main() {
        domain = `https://${document.domain}`;
        api = `${domain}/api.php`;

        myCss();
        timerMananger();

        let link = document.location.href;
        if (link.includes(".php")) {
            return print(`${m}see php, abort`);
        } else if (link.includes("/g/")) {
            print(`${m}gallery page`);
            return setEvent(link);
        } else {
            print(`${m}normal start`);
            if (!checkDisplayMode) return wrongDisplayMode();
            return setButton();
        }

        function myCss() {
            let newcss = document.createElement("style");
            newcss.id = "ehx_direct_download_css";
            document.head.appendChild(newcss);
            newcss.innerHTML = `
                .puretext {
                    overflow: hidden;
                    min-height: 32px;
                    line-height: 16px;
                    margin: 6px 4px 0;
                    font-size: 10pt;
                    text-align: center;
                }

                .show_full_title {
                    overflow: hidden;
                    min-height: 32px;
                    line-height: 16px;
                    margin: 6px 4px 0;
                    font-size: 10pt;
                    text-align: center;
                }
            `;
            let all = document.querySelectorAll(".gl4t");
            if (all) all.forEach(t => { t.className = t.className.replace("gl4t", "show_full_title"); });
        }

        function timerMananger() {
            document.addEventListener("visibilitychange", () => {
                if (timer_list.length > 0) {
                    let pause = (document.visibilityState === "visible") ? false : true;
                    for (let index in timer_list) {
                        let timer = timer_list[index];
                        if (!pause) {
                            timer.id = setInterval(timer.handler, timer.delay);
                            //print(`${m}start timer[${timer.note}] id:${timer.id}`);
                        } else {
                            clearInterval(timer.id);
                            //print(`${m}stop timer[${timer.note}] id:${timer.id}`);
                        }
                    }
                }
            });
        }

        function setEvent(link) {
            let _link = link.split("/");
            if (_link[3] === "g") {
                let gid = _link[4];
                let archive_download = findEleByText("a", "Archive Download");
                archive_download.addEventListener("click", () => {
                    addToDownloadedList(gid);
                });
                print(`${m}set trigger for updateList on gallery:${gid}`);
            }
        }

        function checkDisplayMode() {
            let setting = document.getElementById("dms");
            if (!setting) return false;
            setting = setting.querySelector("option[value='t']");
            return setting.selected;
        }

        function wrongDisplayMode() {
            let pos = document.querySelector(".ido");
            pos.insertAdjacentElement("afterbegin", newSpan("Display mode is not Thumbnail. Script stop"));
        }

        function setButton() {
            let box = document.createElement("div");
            box.id = id_list.mainbox;
            let nodelist = [
                newButton(id_list.dd, "Enable Archive Download / Sorting / Show torrents Title / Fix Event in Ttile", style_list.top_button, enableDirectDownload),
                newLine(),
                newButton(id_list.puretext, "Show Pure Text", style_list.top_button, pureText),
                newLine(),
                newButton(id_list.jump_to_last, "Jump To Nearest Downloaded", style_list.top_button, jumpToLastDownload),
                newLine(),
                newLine(),
            ];
            box = appendAll(box, nodelist);

            document.getElementById("toppane").insertAdjacentElement("afterend", box);
            if (hid) hlexg();
            addInfoToAllGallery();
            setAllLinkToNewTab();
            addTimer(updateGalleryStatus, status_update_interval);

            function enableDirectDownload() {
                let dd = document.getElementById(id_list.dd);
                dd.disabled = true;
                dd.insertAdjacentElement("afterend", newSpan("Processing... Please Wait"));
                acquireGalleryData();

                function acquireGalleryData() {
                    let gallery_nodelist = document.querySelectorAll(".gl1t");
                    let gc = 0;
                    if (gallery_nodelist) {
                        print(`${m}acquire gallery data`);
                        let data = { method: "gdata", gidlist: [], namespace: 1 };
                        let alldata = [];
                        let count = 0;
                        let glist = [];
                        gallery_nodelist.forEach((gallery, index) => {
                            let gid = gallery.getAttribute("gid");
                            let gtoken = gallery.getAttribute("gtoken");
                            if (gid && gtoken) {
                                glist.push([gid, gtoken]);
                                count++;
                                gc++;
                                if (count === 25 || index === gallery_nodelist.length - 1) {
                                    count = 0;
                                    let newdata = Object.assign({}, data);
                                    newdata.gidlist = Object.assign([], glist);
                                    alldata.push(newdata);
                                    glist = [];
                                }
                            }
                        });
                        gcount = gc; // save gallery list count
                        print(`${m}gallery queue length:[${alldata.length}], total gallery count:[${gc}]`);
                        if (alldata.length != 0) {
                            print(`${m}start sending request`);
                            requestData(alldata);
                        } else {
                            print(`${m}gallery queue is empty`);
                        }
                    }
                }

                function requestData(datalist, request_index = 0) {
                    if (request_index >= datalist.length) return;
                    print(`${m}sending request[${request_index + 1}]`);
                    myApiCall(datalist, request_index);
                }

                function myApiCall(datalist, request_index) {
                    let request = new XMLHttpRequest();
                    request.open("POST", api);
                    request.setRequestHeader("Content-Type", "application/json");
                    request.withCredentials = true;
                    request.onreadystatechange = function () {
                        if (request.readyState == 4) {
                            if (request.status == 200) {
                                print(`${m}receive request[${request_index + 1}]`);
                                directDL(request.responseText, request_index + 1);
                                requestData(datalist, request_index + 1);
                            } else {
                                print(`${m}request[${request_index}] failed, status:[${request.status}]`);
                                print(request);
                            }
                        }
                    };
                    request.send(JSON.stringify(datalist[request_index]));
                }
            }

            function pureText() {
                document.getElementById(id_list.puretext).disabled = true;
                let gallery_nodelist = document.querySelectorAll(".gl1t");
                gallery_nodelist.forEach(gallery => {
                    let puretext_span = document.createElement("span");
                    puretext_span.setAttribute("name", id_list.puretext);
                    puretext_span.textContent = gallery.querySelector("a[href]").textContent;
                    puretext_span.className = "puretext";
                    let pos = gallery.querySelector(".gdd");
                    if (pos) {
                        // found dl button
                        pos.insertAdjacentElement("beforebegin", puretext_span);
                        pos.parentElement.querySelector("br").remove();
                    } else {
                        pos = gallery.querySelector(".gl3t");
                        pos.insertAdjacentElement("afterend", puretext_span);
                    }
                });
            }

            function jumpToLastDownload() {
                let last = document.querySelector("[marked='true']");
                if (last) last.scrollIntoView();
            }

            function hlexg() {
                let w = document.querySelectorAll("s");
                if (w.length > 0) {
                    w.forEach(ele => {
                        Object.assign(ele.parentElement.parentElement.parentElement.parentElement.style, style_list.ex);
                    });
                }
            }
        }
    }

    function directDL(data, index) {
        data = JSON.parse(data);
        print(`${m}process request[${index}] data, gallery count:[${Object.keys(data.gmetadata).length}]`);

        let downloaded_list = GM_getValue(key_list.dl_list, default_value.dl_list);
        if (downloaded_list.length != 0) downloaded_list.split(",");

        let gidlist = [];
        let mark_list = [];
        data.gmetadata.forEach(gallery_data => {
            gdata.push(gallery_data);
            let gid = gallery_data.gid;
            let gtoken = gallery_data.token;
            let archiver_key = gallery_data.archiver_key;

            let archivelink = `${domain}/archiver.php?gid=${gid}&token=${gtoken}&or=${archiver_key}`;
            let glink = `${domain}/g/${gid}/${gtoken}/`;
            let gallery = document.querySelector(`.gl1t[gid='${gid}']`);
            if (gallery) {
                let dl_button = document.createElement("button");
                Object.assign(dl_button, {
                    id: `gallery_dl_${gid}`,
                    className: "gdd",
                    textContent: "Archive Download",
                    onclick: function () {
                        let self = this;
                        let ck = document.getElementById(id_list.dl_and_copy).checked;
                        if (ck) {
                            navigator.clipboard.writeText(self.parentElement.querySelector(".glname").textContent.trim())
                                .then(() => downloadButton(self, gid, archivelink, glink));
                        } else {
                            downloadButton(self, gid, archivelink, glink);
                        }
                    },
                });

                Object.assign(dl_button.style, style_list.gallery_button);

                if (downloaded_list.indexOf(`${gid}`) != -1) {
                    Object.assign(dl_button.style, style_list.button_marked);
                    dl_button.setAttribute("marked", true);
                    mark_list.push(gid);
                }

                let pos = gallery.querySelector(".puretext");
                if (!pos) {
                    // no pure text
                    pos = gallery.querySelector(".gl3t");
                    pos.insertAdjacentElement("afterend", dl_button);
                    pos.insertAdjacentElement("afterend", newLine());
                } else {
                    pos.insertAdjacentElement("afterend", dl_button);
                }

                gidlist.push(dl_button.id);
                pcount++;

                let set_status_button = document.createElement("button");
                Object.assign(set_status_button, {
                    id: `gallery_status_${gid}`,
                    className: "gstatus",
                    textContent: "Mark/Unmark This",
                    onclick: function () { setGalleryStatus(gid); },
                });
                Object.assign(set_status_button.style, style_list.gallery_button);

                dl_button.insertAdjacentElement("afterend", set_status_button);
                dl_button.insertAdjacentElement("afterend", newLine());
            }
        });
        if (mark_list.length > 0) print(`${m}found in list, set as downloaded: ${mark_list}`);

        print(`${m}request[${index}] done`);

        if (gcount === pcount) {
            print(`${m}all request done`);
            print(`${m}initializing sorting`);
            print(`${m}process data`);
            processGdata();
            print(`${m}setup sorting button`);
            setSortingButton();
            print(`${m}setup copy title button`);
            setCopyTitle();
            print(`${m}setup show torrent title button`);
            setShowTorrent();
            if (GM_getValue(key_list.auto_fix_title, default_value.auto_fix_title)) {
                print(`${m}fix title`);
                fixTitlePrefix();
            }
        }

        function downloadButton(button, gid, archivelink, glink) {
            Object.assign(button.style, style_list.button_marked);
            button.setAttribute("marked", true);
            visitGallery(glink);
            addToDownloadedList(gid);
            my_popUp(archivelink, 480, 320);
            updateGalleryStatus();
        }

        function setGalleryStatus(gid) {
            gid = `${gid}`; // convert to string
            let downloaded_list = GM_getValue(key_list.dl_list, default_value.dl_list);

            if (downloaded_list.length > 0) {
                downloaded_list = downloaded_list.split(",");

                let index = downloaded_list.indexOf(gid);
                if (index != -1) {
                    downloaded_list.splice(index, 1);
                    print(`${m}gallery:[${gid}] in list, remove from list`);
                    resetGalleryStatus(gid);
                } else {
                    downloaded_list.push(gid);
                    print(`${m}gallery:[${gid}] not in list, add to list`);

                    let count = 0;
                    while (downloaded_list.length > 10000) {
                        let r = downloaded_list.shift();
                        print(`${m}reach limit, remove [${r}]`);
                        count++;
                        if (count > 100) return print(`${m}unknow error while removing old data, script stop`);
                    }
                }
            } else {
                downloaded_list = [gid];
            }
            downloaded_list = downloaded_list.join();
            GM_setValue(key_list.dl_list, downloaded_list);
            print(`${m}save list. [list_size:${downloaded_list.length}, list_length:${downloaded_list.split(",").length}]`);

            updateGalleryStatus();

            function resetGalleryStatus(gid) {
                let gallery = document.querySelector(`[gid="${gid}"]`);
                gallery.style.removeProperty("background-color");
                gallery.removeAttribute("marked");

                let dl_button = gallery.querySelector(".gdd");
                dl_button.style = "";
                Object.assign(dl_button.style, style_list.gallery_button);
                dl_button.removeAttribute("marked");
            }
        }

        function processGdata() {
            let taglist = [
                "artist",
                "group",
            ];
            if (debug_message && debug_adv) console.groupCollapsed();
            gdata.forEach(data => {
                taglist.forEach(tag_key => {
                    data[tag_key] = data.tags.find(s => s.includes(`${tag_key}:`));
                    if (data[tag_key]) {
                        data[tag_key] = data[tag_key].replace(`${tag_key}:`, "");
                    } else {
                        data[tag_key] = "";
                    }
                });
                data.title_original = data.title;
                data.title_jpn_original = data.title_jpn;
                [data.title_prefix, data.title_no_event] = extractPrefix(data.title);

                // try to found prefix in title_jpn
                let [title_jpn,] = extractPrefix(data.title_jpn);
                if (title_jpn.length > 0) data.title_prefix = title_jpn;

                let from_torrent = false;
                if (data.title_prefix.length == 0) {
                    // try to found prefix in torrent
                    let torrent_list = getTorrentList(data.gid);
                    if (torrent_list) {
                        for (let index in torrent_list) {
                            let [prefix,] = extractPrefix(torrent_list[index]);
                            if (prefix) {
                                data.title_prefix = prefix;
                                from_torrent = true;
                                break;
                            }
                        }
                    }
                }

                [data.title_group, data.title_no_group] = extractGroup(data.title_no_event);
                data.title_pure = removeEnd(data.title_no_group);
                if (debug_message && debug_adv) {
                    print(`${String(data.gid).padStart(10)}|__________`);
                    let title_list = [
                        "title_jpn",
                        "title_original",
                        "title_no_event",
                        "title_no_group",
                        "title_pure",
                        "title_prefix",
                        //"title_group",
                    ];
                    title_list.forEach(key => {
                        let add = (from_torrent && key == "title_prefix") ? "　found in torrent" : "";
                        print(`${String(data.gid).padStart(10)}|${key.padStart(25)}|${data[key]}%c${add}`, "color:OrangeRed;");
                    });
                }
            });
            if (debug_message && debug_adv) console.groupEnd();
        }

        function setSortingButton() {
            let pos = document.getElementById(id_list.mainbox);
            let ck_sort_setting = document.createElement("input");
            Object.assign(ck_sort_setting, {
                type: "checkbox",
                id: id_list.sort_setting,
                checked: GM_getValue(key_list.sort_setting, default_value.sort_setting),
            });
            let lable_sort_setting = document.createElement("label");
            Object.assign(lable_sort_setting, {
                htmlFor: id_list.sort_setting,
                textContent: "Descending",
            });
            let ck_dl_copy = document.createElement("input");
            Object.assign(ck_dl_copy, {
                type: "checkbox",
                id: id_list.dl_and_copy,
                checked: GM_getValue(key_list.dl_and_copy, default_value.dl_and_copy),
            });
            let lable_dl_copy = document.createElement("label");
            Object.assign(lable_dl_copy, {
                htmlFor: id_list.dl_and_copy,
                textContent: "Copy Title When Download",
            });
            let ck_auto_fix = document.createElement("input");
            Object.assign(ck_auto_fix, {
                type: "checkbox",
                id: id_list.auto_fix_title,
                checked: GM_getValue(key_list.auto_fix_title, default_value.auto_fix_title),
            });
            let lable_auto_fix = document.createElement("label");
            Object.assign(lable_auto_fix, {
                htmlFor: id_list.auto_fix_title,
                textContent: "Auto Fix Title",
            });

            [ck_sort_setting, ck_dl_copy, ck_auto_fix,].forEach(s => s.addEventListener("change", updateSetting));
            let nodelist = [
                ck_sort_setting, lable_sort_setting, newSeparate(),
                ck_dl_copy, lable_dl_copy, newSeparate(),
                ck_auto_fix, lable_auto_fix, newLine(), newLine(),
                newButton("exhddl_sort_by_title_jp", "Title (JP)", style_list.top_button, () => { sortGalleryByKey("title_jpn"); }),
                newSeparate(),
                newButton("exhddl_sort_by_title_en", "Title (EN)", style_list.top_button, () => { sortGalleryByKey("title"); }),
                newSeparate(),
                newButton("exhddl_sort_by_title_pure", "Title (ignore Prefix/Group/End)", style_list.top_button, () => { sortGalleryByKey("title_pure"); }),
                newSeparate(),
                newButton("exhddl_sort_by_title_no_group", "Title (ignore Prefix/Group)", style_list.top_button, () => { sortGalleryByKey("title_no_group"); }),
                newSeparate(),
                newButton("exhddl_sort_by_title_no_event", "Title (ignore Prefix)", style_list.top_button, () => { sortGalleryByKey("title_no_event"); }),
                newLine(),

                newButton("exhddl_sort_by_date", "Date (Default)", style_list.top_button, () => { sortGalleryByKey("posted"); }),
                newSeparate(),
                newButton("exhddl_sort_by_prefix", "Event", style_list.top_button, () => { sortGalleryByKey("title_prefix"); }),
                newSeparate(),
                newButton("exhddl_sort_by_artist", "Artist", style_list.top_button, () => { sortGalleryByKey("artist"); }),
                newSeparate(),
                newButton("exhddl_sort_by_group", "Group/Circle", style_list.top_button, () => { sortGalleryByKey("group"); }),
                newSeparate(),
                newButton("exhddl_sort_by_category", "Category", style_list.top_button, () => { sortGalleryByKey("category"); }),
                newSeparate(),
                newButton("exhddl_sort_by_ex", "???", style_list.top_button, () => { sortGalleryByKey("expunged"); }),
                newLine(),

                newButton("exhddl_fix_title", "Fix/Unfix Event in Title (Search in torrents/same title gallery)", style_list.top_button, () => { fixTitlePrefix(); }),
            ];
            pos.querySelector("span").remove(); // remove loading message
            appendAll(pos, nodelist);

            function updateSetting() {
                let updatelist = ["sort_setting", "dl_and_copy", "auto_fix_title"];
                let info = [];
                updatelist.forEach(key => {
                    let value = document.getElementById(id_list[key]).checked;
                    GM_setValue(key_list[key], value);
                    info.push(`[${key}]:${value}`);
                });
                print(`${m}updateSetting | ${info.join(" | ")}`);
            }

            function sortGalleryByKey(key = "") {
                if (!key) return;
                getAllGalleryNode();
                sortGdata();
                let sorted_id = getSortedGalleryID(gdata, key);
                let container = document.querySelector(".itg.gld");
                removeAllGallery();
                sorted_id.forEach(id => container.appendChild(gallery_nodes[id].node));
            }
        }

        function setCopyTitle() {
            let gallery_nodelist = document.querySelectorAll(".gl1t");
            gallery_nodelist.forEach(gallery => {
                let gid = gallery.getAttribute("gid");
                let pos = gallery.querySelector(`#gallery_status_${gid}`);
                let button = newButton(`copy_title_${gid}`, "Copy Title", style_list.gallery_button, function () {
                    navigator.clipboard.writeText(this.parentElement.querySelector(".glname").textContent.trim());
                });
                pos.insertAdjacentElement("beforebegin", button);
                pos.insertAdjacentElement("beforebegin", newLine());
            });
        }

        function setShowTorrent() {
            let gallery_nodelist = document.querySelectorAll(".gl1t");
            gallery_nodelist.forEach(gallery => {
                let gid = gallery.getAttribute("gid");
                let torrent_list = getTorrentList(gid);
                if (torrent_list) {
                    let pos = gallery.querySelector(`#gallery_status_${gid}`);
                    torrent_list.forEach(torrent => {
                        let span = newSpan(torrent);
                        span.className = "puretext torrent_title";
                        span.style.display = "none";
                        pos.insertAdjacentElement("afterend", span);
                    });
                    let button = newButton(`t_title_${gid}`, "Show torrent List", style_list.gallery_button, function () {
                        let torrent_list = this.parentElement.querySelectorAll(".torrent_title");
                        torrent_list.forEach(torrent => {
                            torrent.style.display = (torrent.style.display == "none") ? "" : "none";
                        });
                    });
                    pos.insertAdjacentElement("afterend", button);
                    pos.insertAdjacentElement("afterend", newLine());
                }
            });
        }
    }

    function print(...any) {
        if (debug_message) console.log(...any);
    }

    function addTimer(handler, delay, note = "") {
        if (note == "") note = handler.name;
        timer_list.push({
            id: setInterval(handler, delay),
            handler: handler,
            delay: delay,
            note: note,
        });
    }

    function findEleByText(type, string) {
        let es = document.querySelectorAll(type);
        for (let index in es) {
            if (!isNaN(index)) {
                let e = es[index];
                if (e.textContent.includes(string)) {
                    return e;
                }
            }
        }
    }

    function visitGallery(link) {
        if (link) {
            // send request to server, not sure this count or not. (no effect to link states)
            /*
            let r = new XMLHttpRequest();
            r.open("get", link, true);
            r.onreadystatechange = function () {
                if (r.readyState == 4) {
                    if (r.status == 200) {
                        print(`${m}server request success, gallery:${link}`);
                    } else {
                        print(`${m}server request failed, gallery:${link}`);
                        print(r);
                    }
                }
            };
            r.send();
            */
            // trigger :visited
            let current = window.location.href;
            history.pushState({}, "", link); // add link to history. this will change current winodw link.
            print(`${m}add history, link:${window.location.href}`);
            history.pushState({}, "", current); // change it back.
        }
    }

    function addToDownloadedList(gid) {
        gid = `${gid}`; // convert to string
        let downloaded_list = GM_getValue(key_list.dl_list, default_value.dl_list);
        if (downloaded_list.length != 0) {
            downloaded_list = downloaded_list.split(",");

            if (downloaded_list.indexOf(gid) != -1) return print(`${m}[${gid}] is already in the list, abort`);

            downloaded_list.push(gid);

            let count = 0;
            while (downloaded_list.length > 10000) {
                let r = downloaded_list.shift();
                print(`${m}reach limit, remove [${r}]`);
                count++;
                if (count > 100) return print(`${m}unknow error while removing old data, script stop`);
            }
        } else {
            print(`${m}no list found, creat new list`);
            downloaded_list = [gid];
        }
        downloaded_list = downloaded_list.join();
        GM_setValue(key_list.dl_list, downloaded_list);
        print(`${m}add [${gid}] to list. [list_size:${downloaded_list.length}, list_length:${downloaded_list.split(",").length}]`);
    }

    function my_popUp(URL, w, h) {
        window.open(
            URL,
            `_pu${Math.random().toString().replace(/0\./, "")}`,
            `toolbar=0,scrollbars=0,location=0,statusbar=0,menubar=0,resizable=0
            ,width=${w},height=${h},left=${(screen.width - w) / 2},top=${(screen.height - h) / 2}`
        );
        return false;
    }

    function appendAll(node, nodeList) {
        nodeList.forEach(e => node.appendChild(e));
        return node;
    }

    function newSpan(text = "") {
        let span = document.createElement("span");
        Object.assign(span, {
            textContent: text,
        });
        return span;
    }

    function newLine() {
        return document.createElement("br");
    }

    function newSeparate() {
        return newSpan(" / ");
    }

    function newButton(button_id, button_text, button_style, button_onclick) {
        let button = document.createElement("button");
        Object.assign(button, {
            id: button_id,
            textContent: button_text,
            onclick: button_onclick,
        });
        Object.assign(button.style, button_style);
        return button;
    }

    function extractPrefix(string = "") {
        let reg = /^[\(][^\)]*.[\)]/;
        let prefix = reg.exec(string);
        if (prefix) {
            prefix = prefix[0];
            if (!ignore_prefix.some(text => prefix == text)) return [prefix, string.replace(prefix, "").trim()];
        }
        return ["", string];
    }

    function extractGroup(string = "") {
        let reg = /^[\[【][^\]】]*.[\]】]/;
        let group = reg.exec(string);
        return group ? [group[0], (string.replace(group[0], "")).trim()] : ["", string];
    }

    function removeEnd(string = "") {
        let count = 0;
        let container_list = ["[]", "()", "【】",];
        let container_start = [];
        let container_end = [];
        container_list.forEach(text => { container_start.push(text[0]); container_end.push(text[1]); });

        while (count < 100) {
            let type = container_end.find(end => string.lastIndexOf(end) == string.length - 1);
            if (!type) break;
            count++;
            let start = container_start[container_end.indexOf(type)];
            let cut = string.lastIndexOf(start);
            if (cut > 0) {
                cut = string.slice(cut);
                string = string.replace(cut, "").trim();
                //print(`left: "${string}" | removed: "${cut}"`);
            } else {
                print(`incomplete container, abort | "${string}"`);
                break;
            }
        }
        return string;
    }

    function sortGdata() {
        let newdata = [];
        for (let gid in gallery_nodes) {
            newdata.push(gdata.find(gallery_data => gallery_data.gid == gid));
        }
        gdata = newdata;
    }

    function getSortedGalleryID(object_list, sort_key) {
        let newlist = [];
        let descending = document.getElementById(id_list.sort_setting);
        descending = descending.checked ? true : false;
        newlist = object_list.sort((a, b) => {
            return descending ? naturalSort(b[sort_key], a[sort_key]) : naturalSort(a[sort_key], b[sort_key]);
        });

        let new_id_list = [];
        print(`${m}sort by: ${sort_key}`);
        if (debug_message && debug_adv) console.groupCollapsed();
        if (newlist) newlist.forEach(data => {
            new_id_list.push(data.gid);
            if (debug_message && debug_adv) print(`${String(data.gid).padStart(10)} | ${data[sort_key]}`);
        });
        if (debug_message && debug_adv) console.groupEnd();

        return new_id_list;

        function naturalSort(a, b) {
            return a.localeCompare(b, navigator.languages[0] || navigator.language, { numeric: true, ignorePunctuation: true });
        }
    }

    function getAllGalleryNode() {
        gallery_nodes = {};
        let gallery_nodelist = document.querySelectorAll(".gl1t");
        gallery_nodelist.forEach(gallery => {
            let id = gallery.getAttribute("gid");
            let title = gallery.getAttribute("gtitle");
            let deepcopy = gallery.cloneNode(true);
            copyOnclick(gallery, deepcopy, `#gallery_dl_${id}`);
            copyOnclick(gallery, deepcopy, `#t_title_${id}`);
            copyOnclick(gallery, deepcopy, `#copy_title_${id}`);
            copyOnclick(gallery, deepcopy, `#gallery_status_${id}`);
            gallery_nodes[id] = {
                id: id,
                title: title,
                node: deepcopy,
            };
        });

        function copyOnclick(original, copy, css_selector) {
            let o = original.querySelector(css_selector);
            if (o) copy.querySelector(css_selector).onclick = o.onclick;
        }
    }

    function removeAllGallery() {
        let gallery_nodelist = document.querySelectorAll(".gl1t");
        gallery_nodelist.forEach(gallery => gallery.remove());
    }

    function fixTitlePrefix() {
        prefix_fixed = prefix_fixed ? false : true;
        let gallery_nodelist = document.querySelectorAll(".gl1t");
        gallery_nodelist.forEach(gallery => {
            let id = gallery.getAttribute("gid");
            let data = gdata.find(gallery_data => gallery_data.gid == id);
            let title_ele = gallery.querySelector(".glname");
            let prefix = data.title_prefix;
            if (prefix_fixed) {
                if (prefix.length > 0) {
                    let checklist = [
                        title_ele.innerHTML,
                        data.title,
                        data.title_original,
                        data.title_jpn,
                    ];
                    ignore_prefix.forEach(ignore => checklist.push(ignore));
                    if (checklist.some(title => title.includes(prefix))) return;
                    data.title = `${prefix} ${data.title_original}`;
                    data.title_jpn = `${prefix} ${data.title_jpn}`;
                    title_ele.innerHTML = data.title_jpn ? data.title_jpn : data.title;
                    print(`${m}[${id.padStart(10)}] add prefix "${prefix}"`);
                } else {
                    // search in same title gallery
                    let same_title = gdata.find(gallery_data => (gallery_data.title_pure == data.title_pure) && (gallery_data.title_prefix.length > 0));
                    if (same_title) {
                        let new_prefix = same_title.title_prefix;
                        data.title_prefix = new_prefix;

                        data.title = `${new_prefix} ${data.title_original}`;
                        data.title_jpn = `${new_prefix} ${data.title_jpn_original}`;
                        title_ele.innerHTML = (data.title_jpn.length > 0) ? data.title_jpn : data.title;
                        print(`${m}[${id.padStart(10)}] add prefix "${new_prefix}" %cfrom [${same_title.gid}]`, "color:OrangeRed;");
                    }
                }
            } else {
                data.title = data.title_original;
                data.title_jpn = data.title_jpn_original;
                title_ele.innerHTML = data.title_jpn ? data.title_jpn : data.title;
            }
            let title_puretext = gallery.querySelector(`[name="${id_list.puretext}"]`);
            if (title_puretext) title_puretext.innerHTML = title_ele.innerHTML;
        });
    }

    function getTorrentList(gid = "") {
        let list = [];
        let torrents = gdata.find(gallery_data => gallery_data.gid == gid);
        if (!torrents) {
            print(`${m}${gdata.gid} have no torrents`);
            return false;
        }
        torrents = torrents.torrents;
        if (torrents.length == 0) return false;
        torrents.forEach(torrent => list.push(torrent.name));
        return list.reverse();
    }

    function addInfoToAllGallery() {
        let gallery_nodelist = document.querySelectorAll(".gl1t");
        gallery_nodelist.forEach(gallery => {
            let link = gallery.querySelector("a").href;
            let id = link.split("/g/")[1].split("/")[0];
            let token = link.split("/g/")[1].split("/")[1];
            let title = gallery.querySelector(".glname").textContent;

            gallery.setAttribute("gid", id);
            gallery.setAttribute("gtoken", token);
            gallery.setAttribute("gtitle", title);
        });
    }

    function setAllLinkToNewTab() {
        let gallery_nodelist = document.querySelectorAll(".gl1t");
        gallery_nodelist.forEach(gallery => {
            gallery.querySelectorAll("a").forEach(a => {
                if (a.href.includes("/g/")) a.target = "_blank";
            });
        });
    }

    function updateGalleryStatus() {
        let list = GM_getValue(key_list.dl_list, default_value.dl_list);

        if (list.length <= 0) return; // no downloaded gallery in list, abort
        list = list.split(",");

        let find_button = document.querySelector(".itg.gld");
        if (!find_button) return print(`${m}gallery list not found`);

        find_button = find_button.querySelectorAll("button");
        if (find_button.length > 0) updateButtonStatus();

        updateGalleryColor();

        function updateGalleryColor() {
            let gallery_nodelist = document.querySelectorAll(".gl1t");
            let marked = [];
            gallery_nodelist.forEach(gallery => {
                let id = gallery.getAttribute("gid");
                if (list.indexOf(id) != -1 && !gallery.getAttribute("marked")) {
                    Object.assign(gallery.style, style_list.gallery_marked);
                    gallery.setAttribute("marked", true);
                    marked.push(id);
                }
            });
            if (marked.length > 0) print(`${m}found in list, mark gallery: ${marked}`);
        }

        function updateButtonStatus() {
            let marked = [];
            gdata.forEach(gallery_data => {
                let gid = gallery_data.gid;
                let dl_button = document.querySelector(`#gallery_dl_${gid}`);
                if (list.indexOf(`${gid}`) != -1 && !dl_button.getAttribute("marked")) {
                    Object.assign(dl_button.style, style_list.button_marked);
                    dl_button.setAttribute("marked", true);
                    marked.push(gid);
                }
            });
            if (marked.length > 0) print(`${m}found in list, mark dl_button: ${marked}`);
        }
    }
})();
