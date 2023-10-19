'use strict';

const Hapi = require('@hapi/hapi');
const os = require('node:os');
const util = require('node:util');
const child_process = require("node:child_process");
const exec = util.promisify(child_process.exec);
const spawn = child_process.spawn;
const spawnSync = child_process.spawnSync;
const Boom = require('@hapi/boom');
const Hoek = require('@hapi/hoek');
const Fs = require('node:fs');
const Path = require('node:path');
const init = async () => {

    const server = Hapi.server({
        port: 7865,
        host: '0.0.0.0'
    });

    await server.register(require('@hapi/vision'));

    server.views({
        engines: { html: require('handlebars') },
        path: __dirname + '/templates'
    });

    server.route({
        method: 'GET',
        path: '/',
        handler: async (request, h)=> {
            const context = {title: 'RVc'};
            return h.view('index', context);
        }
    });

    //node 执行shell并传递参数给python实例
    server.route({
        method: 'GET',
        path: '/shell',
        handler: async (request, h)=> {
            const shell = async (d,cmd)=>{
                const shellSync = async ()=>{
                    return new Promise(resolve => {
                        const res = spawn(d, cmd); 
                        const result = {};
                        res.stdout.on('data', (data) => {
                            console.log(`stdout: ${data}`);
                        })
                        res.stderr.on('data', (data) => {
                            result.message = data
                            console.error(`stderr: ${data}`);
                        });
                        res.on('close', (code) => {
                            result.status = !code
                            resolve(result)
                            console.log(`child process exited with code ${code}`);
                        });
                    }); 
                } 
                let {status,message} = await shellSync();
                if(!status){ throw Boom.badRequest(message)}
            }    
            await shell('node',['test.js']);
            await shell('python3',['test.py',`--dir=testdir`,`--name=testname`]);
            return h.response('shell');
        }
    });

    //上传到本地文件
    server.route({
        method: 'POST',
        path: '/upload',
        options:{
            payload: {
                output: 'stream',                                           //参考https://hapijs.com/api#-routeoptionspayloadoutput
                parse:true,
                multipart: true,
                maxBytes:1048576 * 50,     //允许上传 50mb
                timeout:1000 * 60            //上传超时默认60秒
            },
        },
        handler: async (request, h)=> {
            const {file} = request.payload;
            const name = file.hapi.filename;
            //判断文件夹是否存在，不存在创建
            const exitsFolder = async (reaPath)=>{
                const absPath = Path.join(process.cwd(), reaPath);
                try {
                await Fs.promises.stat('absPath');
                } catch (e) {
                await Fs.promises.mkdir(absPath, {recursive: true});
                }
            };
            const filePath = "/upload"
            await exitsFolder(filePath);
            const filePathName = Path.join(process.cwd(),`${filePath}/${name}`)
            await file.pipe(Fs.createWriteStream(filePathName));
            return h.response('success');
            
        }
    });

    //aws3 实例
    server.route({
        method: 'POST',
        path: '/aws3',
        options:{
            payload: {
                output: 'stream',                                           //参考https://hapijs.com/api#-routeoptionspayloadoutput
                parse:true,
                multipart: true,
                maxBytes:1048576 * 50,     //允许上传 50mb
                timeout:1000 * 60            //上传超时默认60秒
            },
        },
        handler: async (request, h)=> {
            
            return h.response('success');
            
        }
    });

    await server.start();
    console.log('Server running on %s', server.info.uri);
};

process.on('unhandledRejection', (err) => {
    console.log(err);
    process.exit(1);
});

init();