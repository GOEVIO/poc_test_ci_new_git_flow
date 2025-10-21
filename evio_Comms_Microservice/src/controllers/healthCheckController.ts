async function checkHealth(req, res) {
    res.status(200).send('OK');
}

export default {
    checkHealth,
};
