const toggle = require('evio-toggle').default;

const handleRemoteFunctionStart = async (req, res, next) => {
  const context = "[Middleware - handleRemoteFunctionStart]";
  try {
    const useNewApproachStartSession = await toggle.isEnable('charge-378-improve-start-success');
    req.useNewApproachStartSession = useNewApproachStartSession;
  } catch (error) {
    console.error(`${context} - Error checking toggle: ${error.message}`);
    req.useNewApproachStartSession = false;
  }
  next();
};

module.exports = {
  handleRemoteFunctionStart
};