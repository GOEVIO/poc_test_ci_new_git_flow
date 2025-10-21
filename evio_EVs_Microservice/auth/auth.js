const validateUserPerClientName = (headers, includeWebClient = false) => {
  const { clientname: clientName, client: clientType } = headers;
  const isWhiteLabelKinto = clientName == process.env.WhiteLabelKinto;
  const isAndroidOrIos =
    clientType.toLowerCase().includes('android') ||
    clientType.toLowerCase().includes('ios');
  const isWebClient = clientType.toLowerCase().includes('backoffice');

  if (includeWebClient) {
    return !(isWhiteLabelKinto && (isAndroidOrIos || isWebClient));
  }

  return !(isWhiteLabelKinto && isAndroidOrIos);
};

module.exports = {
  validateUserPerClientName,
};
