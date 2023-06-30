sub2vtt = require('./sub2vtt');

module.exports = async (req, res) => {
	try {

		let url, proxy;
		if (req?.query?.proxy) proxy = JSON.parse(Buffer.from(req.query.proxy, 'base64').toString());
		if (req?.query?.from) url = req.query.from
		else throw 'error: no url';
		console.log("url", url, "proxy", proxy)
		generated = sub2vtt.gerenateUrl(url, { referer: "someurl" });
		console.log(generated);
		let sub = new sub2vtt(url, proxy);
		//console.log(await sub.CheckUrl()) 
		let file = await sub.getSubtitle();
		//console.log(file)
		/*//console.log("file",file)*/
		if (!file?.subtitle) throw (file?.status || 'sub.vtt: error getting sub')
		res.setHeader('Cache-Control', 'max-age=21600, stale-while-revalidate=10800, stale-if-error=10800, public');
		res.setHeader('Content-Type', 'text/vtt;charset=UTF-8');
		res.send(file.subtitle)
		res.end()

	} catch (err) {
		res.setHeader('Cache-Control', 'max-age=0, no-cache, no-store, must-revalidate');
		res.setHeader('Content-Type', 'application/json');
		res.sendStatus(500).end()

		console.error(err);
	}
}