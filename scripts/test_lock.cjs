const lock = async (name, ...args) => {
    console.log("Name:", name);
    console.log("Args:", args);
    const acquire = args.pop();
    console.log("Acquire typeof:", typeof acquire);
    if (typeof acquire === 'function') {
        return await acquire();
    }
};

lock('test-lock', { mode: 'exclusive' }, async () => {
    console.log("Acquire executed!");
    return "SUCCESS";
}).then(res => console.log("Result:", res));

lock('test-lock2', async () => {
    console.log("Acquire 2 executed!");
    return "SUCCESS 2";
}).then(res => console.log("Result 2:", res));
