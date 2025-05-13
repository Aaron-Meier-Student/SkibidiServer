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
const ids = {};
const requests = {};
let requestCount = 0;
let totalBytes = 0;
const maxConnections = 8;

for (let i = 1; i <= maxConnections; i++) {
    ids[i] = null;
}

function getId() {
    for (let i = 1; i <= maxConnections; i++) {
        if (ids[i] === null) {
            return i;
        }
    }
    return null;
}

server.on("connection", (ws) => {
    if (connections.length >= maxConnections) return ws.close();
    connections.push(ws);
    const id = getId();
    ids[id] = ws;
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
        analyzeRequest(message);
        connections.forEach((connection) => {
            if (connection === ws) return;
            connection.send(message);
        });
    });
    ws.on("close", () => {
        connections.splice(connections.indexOf(ws), 1);
        ids[id] = null;
        connections.forEach((connection) => {
            connection.send(`disconnect||${id}`);
        });
    });
});

async function analyzeRequest(message) {
    totalBytes += Buffer.byteLength(message);
    message = Buffer.from(message).toString();
    const method = message.split("||")[0];
    if (!requests[method]) requests[method] = 0;
    requests[method]++;
}

function convertBytes(bytes) {
    const kb = bytes / 1024;
    const mb = kb / 1024;
    const gb = mb / 1024;

    return {
        bytes,
        kb: kb.toFixed(2),
        mb: mb.toFixed(2),
        gb: gb.toFixed(2),
    };
}

const App = () => {
    const [line1, setLine1] = useState(`Connections: ${connections.length}/${maxConnections}`);
    const [line2, setLine2] = useState(`Total Requests: ${requestCount}`);
    const [lines, setLines] = useState([]);

    useEffect(() => {
        const interval = setInterval(() => {
            setLine1(`Connections: ${connections.length}/${maxConnections}`);
            setLine2(
                `Total Requests | ${numbro(requestCount).format({
                    average: true,
                    mantissa: 2,
                })} | ${convertBytes(totalBytes).kb} kb`
            );

            const entries = Object.entries(requests);
            const maxLabelLength = Math.max(
                ...entries.map(([key]) => key.length),
                6
            );
            const formatLine = (prefix, method, count) => {
                const paddedMethod = method.padEnd(maxLabelLength, " ");
                return `${prefix} ${paddedMethod} | ${count}`;
            };

            const summaryLines = [];

            if (entries.length > 0) {
                entries.forEach(([method, count], i) => {
                    const isLast = i === entries.length - 1;
                    summaryLines.push(
                        formatLine(
                            isLast ? "└" : "├",
                            method,
                            numbro(requests[method]).format({
                                average: true,
                                mantissa: 2,
                            })
                        )
                    );
                });
            }

            setLines(summaryLines);
        }, 100);

        return () => clearInterval(interval);
    }, []);

    return React.createElement(
        React.Fragment,
        null,
        React.createElement(Text, { color: "red" }, `${networkIp}:${port}`),
        React.createElement(Text, { color: "yellow" }, line1),
        React.createElement(Text, { color: "green" }, line2),
        ...lines.map((line, i) =>
            React.createElement(Text, { key: i, color: "white" }, line)
        )
    );
};
render(React.createElement(App));
