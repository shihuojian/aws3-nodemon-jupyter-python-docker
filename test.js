const Hoek = require('@hapi/hoek');
const init = async()=>{
    console.log("start timer 等待5s执行下一步")
    await Hoek.wait(5000);
    console.log("await 5000 end")
}
init()
