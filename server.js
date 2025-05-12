import React, { useEffect, useState } from "react";
import { WebSocketServer } from "ws";
import { render, Text } from "ink";
import numbro from "numbro";
import os from "os";

function getLocalIPv4() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === "IPv4" && !iface.internal) {
                return iface.address;
            }
        }
    }
    return "127.0.0.1";
}

const networkIp = getLocalIPv4();
const port = process.argv[2] || 8080;

const server = new WebSocketServer({ port });

const connections = [];
const ids = [];
let currentId = 1;
let requestCount = 0;

server.on("connection", (ws) => {
    connections.push(ws);
    const id = currentId;
    currentId++;
    ids.push(id);
    connections.forEach((connection) => {
        if (connection === ws) {
            connection.send(`self||${id}`);
        } else {
            connection.send(`connect||${id}`);
            ws.send(`connect||${ids[connections.indexOf(connection)]}`);
        }
    });
    ws.on("message", (message) => {
        requestCount++;
        connections.forEach((connection) => {
            if (connection === ws) return;
            connection.send(message);
        });
    });
    ws.on("close", () => {
        connections.splice(connections.indexOf(ws), 1);
        ids.splice(ids.indexOf(id), 1);
        connections.forEach((connection) => {
            connection.send(`disconnect||${id}`);
        });
    });
});

const App = () => {
    const [line1, setLine1] = useState(`Connections: ${connections.length}`);
    const [line2, setLine2] = useState(`Total equests: ${requestCount}`);
    useEffect(() => {
        const interval = setInterval(() => {
            setLine1(`Connections: ${connections.length}`);
            setLine2(
                `Requests: ${numbro(requestCount).format({
                    average: true,
                    mantissa: 2,
                })}`
            );
        }, 10);
        return () => clearInterval(interval);
    }, []);

    return React.createElement(
        React.Fragment,
        null,
        React.createElement(Text, { color: "red" }, `${networkIp}:${port}`),
        React.createElement(Text, { color: "yellow" }, line1),
        React.createElement(Text, { color: "green" }, line2)
    );
};
render(React.createElement(App));
