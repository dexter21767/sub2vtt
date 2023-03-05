const { convert } = require('subtitle-converter');
const unrar = require("node-unrar-js");
const AdmZip = require('adm-zip');
const axios = require('axios');

const iconv = require('iconv-jschardet');
iconv.skipDecodeWarning(true)
iconv.disableCodecDataWarn(true)


const iso639 = require('./ISO639');


class sub2vtt {
    constructor(url , proxy) {
        this.url = url;
        this.proxy = proxy || {};
        this.data = null;
        this.size = null;
        this.error = null;
        this.type = null;
        this.client = null;
    }

    async GetData() {
        let res = await this.request({
            method: 'get',
            url: this.url,
            responseType: 'arraybuffer'
        });
        if(res?.data){
        this.type = res.headers["content-type"].split(';')[0];
        this.data = res.data;
        this.size = Number(headers["content-length"]);
        }
    }

    GiveData(data){
        this.data = data;
    }
    DatafromHeaders(headers){
        this.type = headers["content-type"].split(';')[0];
        this.size = Number(headers["content-length"]);
    }

    async getSubtitle() {
        try {
            // checking the link

            let file
            console.log("this.type",this.type)
            console.log("this.data",this.data)

            if(!this.type) await this.CheckUrl()
            
            if(!this.type || !this.data ) await this.GetData();
            if(!this.type || !this.data) throw "error getting sub"
            
            if(this.size?.length>10000000) throw "file too big"
            //get the file
            if (this.supported.arc.includes(this.type)) {
                file = await this.extract()
                if (!file) throw "error extracting archive"
            }
            if (this.supported.subs.includes(this.type)) {
                file = await this.GetSub()
            } else {
                if (file) file = await this.GetSub(file)
                else file = await this.GetSub()
            }
            return file
        } catch (e) {
            console.error(e);
        }
    }

    async CheckUrl() {
        try {

            let res = await this.request(
                {
                    method: "head",
                    url:this.url,
                })

            if (!res || !res.status == "200" || !res.headers) throw "error getting headers"
            let headers = res.headers;
            if (!headers) throw "the url provided couldn't be reached";

            this.DatafromHeaders(headers);

            if (headers["transfer-encoding"] && headers["transfer-encoding"] == 'chunked') {
                console.log("the file is buffering")
            }

            if (this.type == 'arraybuffer/json') console.log("the file is an array buffer")
            if (this.supported.arc.includes(this.type)) {
                console.log("the requested file is an archive")
            } else if (this.supported.subs.includes(this.type)) {
                console.log("the requested file is a subtitle")
            } else console.log("unsupported file format")

        } catch (err) {
            console.error(err);
            return { res: "error",reason:err };
        }
    }

    async extract() {
        try {
            
            if (!this.data) throw "error requesting file"
            res = this.data;
            const rar = this.supported.arcs.rar
            const zip = this.supported.arcs.zip
            if (rar.includes(this.type)) {
                return await this.unrar(res);
            } else if (zip.includes(this.type)) {
                return await this.unzip(res);
            }
            return
        } catch (err) {
            console.error(err);
            this.error = err;
        }

    }



    async GetSub(data) {
        try {
            let res;

            if (data) {
                res = data
            } 
            else if(this.data) res = this.data
            else {
                res = await this.request({
                    method: 'get',
                    url: this.url,
                    responseType: 'arraybuffer'
                });
                if(res?.data) res = res.data
                if (!res) throw "error requesting file"
            }
            var data = iconv.encode(res, 'utf8').toString();
            console.log("data",data.length)
            const outputExtension = '.vtt'; // conversion is based on output file extension
            const options = {
                removeTextFormatting: true,
                startAtZeroHour: false,
                timecodeOverlapLimiter: false,
            };
            const { subtitle, status } = convert(data, outputExtension, options)
            console.log(status)
            if (subtitle) return { res: "success", subtitle: subtitle, status: status, res: data }
            //if (status.success) return { res: "success", subtitle: subtitle, status: status, res: res }
            else return { res: "error", subtitle: null }
        } catch (err) {
            console.error(err);
            this.error = err;
            return { res: "error", subtitle: data }
        }
    }


    supported = {
        arc: ["application/zip","application/x-zip-compressed", "application/x-rar", "application/x-rar-compressed", "application/vnd.rar"],
        subs: ["application/x-subrip", "text/vtt", "application/octet-stream"],
        arcs: {
            rar: ["application/x-rar", "application/x-rar-compressed", "application/vnd.rar"],
            zip: ["application/zip","application/x-zip-compressed"]

        }
    }

    async unzip(file) {
        try {
            var zip = new AdmZip(file);
            var zipEntries = zip.getEntries();
            console.log(zipEntries.length)
            const files = []
            for (var i = 0; i < zipEntries.length; i++) {
                console.log(zipEntries[i].entryName);
                if (zipEntries[i].entryName.match(/.dfxp|.scc|.srt|.ttml|.ssa|.vtt|.ass|.srt/gi))
                    files.push(zipEntries[i].getData())
            }
            console.log(files.length)
            if (files?.length) return files[0]
            else return
        } catch (err) {
            console.error(err);
        }
    }

    async unrar(file) {
        try {

            const extractor = await unrar.createExtractorFromData({ data: file });

            const list = extractor.getFileList();
            const listArcHeader = list.arcHeader; // archive header
            const fileHeaders = [...list.fileHeaders]; // load the file headers

            const filesNames = []
            for (var i = 0; i < fileHeaders.length; i++) {
                if (fileHeaders[i].name.match(/.dfxp|.scc|.srt|.ttml|.ssa|.vtt|.ass|.srt/gi)) {
                    filesNames.push(fileHeaders[i].name)
                }
            }

            const extracted = extractor.extract({ files: filesNames });
            // extracted.arcHeader  : archive header
            const files = [...extracted.files]; //load the files
            files[0].fileHeader; // file header
            files[0].extraction; // Uint8Array content, createExtractorFromData only

            return files[0].extraction
        } catch (err) {
            console.error(err);
        }
    }

    async request(options) {
        if(!this.client) this.getClient()
        return await this.client(options)
            .catch(error => {
                if (error.response) {
                    console.error(error.response.status, error.response.statusText, error.config.url);
                } else if (error.cause) {
                    console.error(error.cause);
                } else {
                    console.error(error);
                }
            });

    }
    getClient () {
        let config = {
            timeout: 15000,
            headers : {}
        }
        if(this.proxy) config.headers = this.proxy;
        config.headers["Accept-Encoding"] = "gzip,deflate,compress";
         
        this.client = axios.create(config);
    }
    static gerenateUrl(url=String, proxy){
        let proxyString,data;
        data= new URLSearchParams();
        data.append("from",url)
        if(proxy) proxyString = Buffer.from(JSON.stringify(proxy)).toString('base64');
        if(proxy) data.append("proxy",proxyString)
        return data.toString();
    }
    static ISO(){
        return iso639;
    }
};

module.exports = sub2vtt;
