const WebSocket = require('ws');

const wsServer = new WebSocket.Server({ port: 3014 });

wsServer.on('connection', function connection(ws) {

  
  ws.on('message', function inco  ming(message) {
    console.log('received: %s', message);
  });

  ws.on('close', function (reasonCode, description) {
  console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected.');
});
  
  ws.send('something 3');
});

function originIsAllowed(origin) {
  // put logic here to detect whether the specified origin is allowed.
  return true;
}














// wsServer.on('request', function (request) {
//   console.log('request.origin');
//   if (!originIsAllowed(request.origin)) {
//     // Make sure we only accept requests from an allowed origin
//     request.reject();
//     console.log((new Date()) + ' Connection from origin ' + request.origin + ' rejected.');
//     return;
//   }

//   var connection = request.accept('echo-protocol', request.origin);
//   console.log((new Date()) + ' Connection accepted.');
//   connection.on('message', function (message) {
//     if (message.type === 'utf8') {
//       console.log('Received Message: ' + message.utf8Data);
//       connection.sendUTF(message.utf8Data);
//     }
//     else if (message.type === 'binary') {
//       console.log('Received Binary Message of ' + message.binaryData.length + ' bytes');
//       connection.sendBytes(message.binaryData);
//     }
//   });
  
// });
