const Hoek = require('@hapi/hoek');
const init = async()=>{
    console.log("start timer 等待5s执行下一步")
    await Hoek.wait(5000);
    console.log("await 5000 end")
}
init()

// const init = async()=>{
//     const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
//     const { S3Client, GetObjectCommand,DeleteObjectCommand } = require("@aws-sdk/client-s3");
//     const client = new S3Client({
//         region:"ap-east-1",
//         credentials:{
//             accessKeyId:"AKIAQ5QAJCD2C3HB2TXB",
//             secretAccessKey:"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"
//         }
//     });
//     const command = new DeleteObjectCommand({
//         Bucket:"shihuojian-private-test",
//         Key:'./3.png'
//     });
//     const response = await client.send(command);
//     // const url = await getSignedUrl(client, command, { expiresIn: 3600 });
//     console.log(response)
// }

// init()