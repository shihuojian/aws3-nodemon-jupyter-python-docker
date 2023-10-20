var http = require('node:http');
var request = require('request');
// var URL = require('url');
// 创建http服务
var app = http.createServer(function (req, res) {
//   var url = URL.parse(req.url).query; //获取url参数
  request.get("https://clouds.ecs001.com/image/2023-09-04/64f5a5535a5c137f615bf494.png").pipe(res);
});
console.log('http://127.0.0.1:8403');
app.listen(8403);