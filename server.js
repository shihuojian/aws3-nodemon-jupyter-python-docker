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
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const Request = require('request');

//aws S3配置
const { S3Client, GetObjectCommand,PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } = require("@aws-sdk/client-s3");
// const s3Client = new S3Client({
//     region:"ap-east-1",
//     credentials:{
//         accessKeyId:"",
//         secretAccessKey:""
//     }
// })

//digitalocean配置，参考https://docs.digitalocean.com/products/spaces/reference/s3-sdk-examples/
const s3Client = new S3Client({
    forcePathStyle: false, // Configures to use subdomain/virtual calling format.
    endpoint: "https://nyc3.digitaloceanspaces.com",
    region: "us-east-1",
    credentials: {
      accessKeyId: "",
      secretAccessKey: ""
    }
});
const init = async () => {

    const server = Hapi.server({
        port: 8888,
        host: '0.0.0.0'  //服务器运行填写私有地址
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

            //同步写入文件流
            const asynWriteFile = async (readStream,filePath)=>{
                return new Promise(resolve=>{
                    const stream = Fs.createWriteStream(filePath);
                    readStream.pipe(stream);
                    stream.on('close', function (err) {
                        resolve()
                    });
                })
            }

            let filePath = "/upload"
            await exitsFolder(filePath);
            filePath = Path.join(process.cwd(),`${filePath}/${name}`);
            // await file.pipe(Fs.createWriteStream(filePathName)); //异步写入文件
            await asynWriteFile(file,filePath)
            return h.response('success');
            
        }
    });

    //aws3 实例
    server.route({
        method: 'POST',
        path: '/aws3',
        options:{
            payload: {
                output: 'stream',          //可以设置data,file等                                 //参考https://hapijs.com/api#-routeoptionspayloadoutput
                parse:true,
                multipart: true,
                maxBytes:1048576 * 100,     //允许上传 50mb
                timeout:1000 * 60            //上传超时默认60秒
            },
        },
        handler: async (request, h)=> {
            try {
                
                //从bucket获取一张图片，并在60m后过期
                const getObjectURL = async (Key)=>{
                    const command = new GetObjectCommand({
                        Bucket:"shihuojian-private-test",
                        Key
                    });
                    return await getSignedUrl(s3Client,command,{ expiresIn: 60 });
                }
                // const res = await getObjectURL('upload/image-1697713779579.jpeg');

                //生成一个临时上传文件url接口，有效期10s,不设置貌似900s后过期
                const putObject = async (filename,ContentType)=>{
                    const command = new PutObjectCommand({
                        Bucket:"shihuojian-private-test",
                        Key:`upload/${filename}`,
                        ContentType
                    });
                    return await getSignedUrl(s3Client,command,{ expiresIn: 60 });
                }
                // const res = await putObject(`image-${Date.now()}.jpeg`,"image/jpeg")

                //列出/目录
                const listObjects = async ()=>{
                    const command = new ListObjectsV2Command({
                        Bucket:"shihuojian-private-test",
                        Key:`/`
                    });
                    return await s3Client.send(command);
                }
                // const res = await listObjects();

                //删除文件,有问题因为key暴露给github，被aws检测到了自动增加了防止删除策略。
                const delObjects = async ()=>{
                    const command = new DeleteObjectCommand({
                        Bucket:"shihuojian-private-test",
                        Key:'3.png'
                    });
                    await s3Client.send(command);
                }
                // const res = await delObjects();

                //上传文件
                const uploadObject = async(Key,Body,ContentType)=>{
                    const command = new PutObjectCommand({
                        Bucket:"wissai",Key,Body,ContentType
                    });
                    return await s3Client.send(command)
                }
                const file = request.payload.file;
                const name = `${Date.now()}-${Path.basename(file.hapi.filename)}`;  //如果是模型的话需要固定名称，不然训练有问题,
                return await uploadObject(name,file._data,file.hapi.headers["content-type"]);
                // const url = await getObjectURL(name);   //获取到的图片无法访问，需要apn，解决办法可以在服务器获取数据流输出
                // const base64 = Buffer.from(url).toString('base64');
                // return h.response(base64);

            } catch (error) {
                throw Boom.badRequest(error)
            }    
            
        }
    });

    //直接输出stream，可以国内限制以及破解防盗链等
    server.route({
        method: 'GET',
        path: '/url/{url}',
        handler: async (request, h)=> {
            try{
                const url = request.params.url;
                if(url){
                    Request.get(Buffer.from(url, 'base64').toString('ascii').replace(/&amp;/g,"&")).pipe(request.raw.res);
                    return h.abandon
                }else{
                    return h.close
                }
            } catch (error) {
                throw Boom.badRequest(error)
            }    
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
