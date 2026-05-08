// Logistics Game Prototype - Core Logic and Player Mode Implementation
const cities = ["Ironvale", "Northport", "Lakeview", "Westhaven", "Centralia", "Eastgate", "Southport", "Coastview"];

const cityData = {
    Ironvale: { max_stock: 5, replenish: 1, purchase_cost: 1 },
    Northport: { max_stock: 6, replenish: 2, purchase_cost: 2 },
    Lakeview: { max_stock: 4, replenish: 1, purchase_cost: 3 },
    Westhaven: { max_stock: 5, replenish: 1, purchase_cost: 1 },
    Centralia: { max_stock: 7, replenish: 2, purchase_cost: 2 },
    Eastgate: { max_stock: 4, replenish: 1, purchase_cost: 2 },
    Southport: { max_stock: 6, replenish: 2, purchase_cost: 2 },
    Coastview: { max_stock: 4, replenish: 1, purchase_cost: 3 }
};

const routes = {
    road: { cost: 1, delayOn: [1, 2] },
    rail: { cost: 2, delayOn: [1] },
    sea: { cost: 1, delayOn: [1, 2, 3] },
    air: { cost: 3, delayOn: [] }
};

const edges = [
    ["Ironvale", "Westhaven", "road"], 
    ["Ironvale", "Northport", "rail"], 
    ["Ironvale", "Centralia", "rail"],
    ["Westhaven", "Centralia", "road"], 
    ["Westhaven", "Southport", "sea"], 
    ["Northport", "Centralia", "rail"],
    ["Northport", "Lakeview", "air"], 
    ["Lakeview", "Centralia", "road"], 
    ["Lakeview", "Eastgate", "road"],
    ["Centralia", "Eastgate", "rail"], 
    ["Centralia", "Southport", "road"], 
    ["Centralia", "Coastview", "air"],
    ["Eastgate", "Coastview", "sea"], 
    ["Southport", "Coastview", "road"]
];

const nodePos = {
      Ironvale: [140, 260], 
      Northport: [300, 100], 
      Lakeview: [620, 110], 
      Westhaven: [140, 455],
      Centralia: [430, 300], 
      Eastgate: [735, 305], 
      Southport: [430, 485], 
      Coastview: [735, 485]
};

const events = [
    { title: "Roadworks", text: "Road risk worsens by 1. Road delays occur on 1–3 this round." },
    { title: "Rail Strike", text: "Rail risk worsens by 1. Rail delays occur on 1–2 this round." },
    { title: "Storm Front", text: "Sea risk worsens by 1. Sea delays occur on 1–4 this round." },
    { title: "Fuel Surge", text: "Road, rail, and sea movement costs are +1 this round." },
    { title: "Air Subsidy", text: "Air movement cost is -1 this round." },
    { title: "Smooth Operations", text: "Ignore all delays this round." },
    { title: "Supplier Shortfall", text: "All city replenishment is reduced by 1 this round." },
    { title: "Demand Spike", text: "Reveal one extra contract this round." }
];

// #region Common Logic
const graph = buildGraph();
let playerState;

function buildGraph() {
    const g = Object.fromEntries(cities.map(city => [city, []]));
    edges.forEach(([from, to, mode]) => {
        g[from].push({ to, mode });
        g[to].push({ from, mode });
    });
    return g;
}

function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shortestPathLength(start, end) {
    const queue = [[start, 0]];
    seen = new Set([start]);
    while (queue.length) {
        const [city, dist] = queue.shift();
        if (city === end) return dist;
        for (const { to } of graph[city]) {
            if (!seen.has(to)) {
                seen.add(to);
                queue.push([to, dist + 1]);
            }
        }
    }
    return Infinity;
}

function shortestPath(start, end, strategy) {
    const weights = { 
    Conservative: { cost: 1, risk: 3, airBonus: 0 }, 
    Balanced: { cost: 1.5, risk: 1.5, airBonus: 0 }, 
    Opportunistic: { cost: 3, risk: 0.5, airBonus: 0 }, 
    Agile: { cost: 1, risk: 1, airBonus: -1 } 
    }[strategy];
    const queue = [[0, start, []]];
    const best = {};
    while (queue.length) {
        queue.sort((a, b) => a[0] - b[0]);
        const [score, city, path] = queue.shift();
        if (best[city] !== undefined && best[city] <= score) continue;
        best[city] = score;
        for (const { to, mode } of graph[city]) {
            const route = routes[mode];
            const risk = route.delayOn.length / 6;
            const routeScore = route.cost * weights.cost + risk * 10 * weights.risk + (mode === "air" ? weights.airBonus : 0);
            queue.push([score + routeScore, to, path.concat([[to, mode]])]);
            }
        }
    return [];
}
// #endregion
// #region Contract and Event Generation
function generateContractData(roundNumber = 1) {
    const origin = cities[randInt(0, cities.length - 1)];
    let destination = origin;
    while (destination === origin) {
        destination = cities[randInt(0, cities.length - 1)];
    }
    const quantity = randInt(1, 6) <= 2 ? 1 : 2;
    const distance = shortestPathLength(origin, destination);
    const slack = randInt(1, 6) <= 3 ? 0 : 1;
    const deadline = roundNumber + distance + slack;
    const marketBonus = randInt(1, 4);
    const urgencyBonus = slack === 0 ? 2 : 0;
    const purchaseCost = cityData[origin].purchase_cost * quantity;
    const payout = purchaseCost + 2 + 3 * distance + marketBonus + urgencyBonus;
    return { id: cryptoRandomId(), origin, destination, quantity, distance, slack, deadline, marketBonus, urgencyBonus, payout };
}

function cryptoRandomId() {
    return Math.random().toString(36).substr(2, 9);
}

function makeModifiers(eventTitle = "") {
    const mod = { 
        event: eventTitle, 
        riskWorse: new Set(), 
        costBonus: {}, 
        ignoreRisk: false, 
        replenishPenalty: 0, 
        extraContract: 0 };

    if (eventTitle === "Roadworks") mod.riskWorse.add("road");
    if (eventTitle === "Rail Strike") mod.riskWorse.add("rail");
    if (eventTitle === "Storm Front") mod.riskWorse.add("sea");
    if (eventTitle === "Fuel Surge") mod.costBonus = { road: 1, rail: 1, sea: 1 };
    if (eventTitle === "Air Subsidy") mod.costBonus = { air: -1 };
    if (eventTitle === "Smooth Operations") mod.ignoreRisk = true;
    if (eventTitle === "Supplier Shortfall") mod.replenishPenalty = 1;
    if (eventTitle === "Demand Spike") mod.extraContract = 1;

    return mod;
}
// #endregion
// #region Player Mode
function startPlayerGame() {
    playerState = {
    round: 1,
    cash: 18,
    stock: Object.fromEntries(cities.map(c => [c, cityData[c].max_stock])),
    event: null,
    modifiers: makeModifiers(),
    contracts: [],
    active: [],
    completed: [],
    phase: "event",
    acceptedThisRound: false,
    movedThisRound: false,
    gameOver: false
    };
    logPlayer("New game started. Round 1 begins. Draw an event.", true);
    renderPlayer();
}

function playerDrawEvent() {
    if (!requirePhase("event")) return;
    const event = events[randInt(0, events.length - 1)];
    playerState.event = event;
    playerState.modifiers = makeModifiers(event.title);
    playerState.phase = "replenish";
    logPlayer(`Round ${playerState.round} event: ${event.title}. ${event.text}`);
    renderPlayer();
}

    function playerReplenish() {
    if (!requirePhase("replenish")) return;
    for (const city of cities) {
    const amount = Math.max(0, cityData[city].replenish - playerState.modifiers.replenishPenalty);
    playerState.stock[city] = Math.min(cityData[city].max_stock, playerState.stock[city] + amount);
    }
    playerState.phase = "contracts";
    logPlayer("Cities replenished. Reveal contracts next.");
    renderPlayer();
}

function playerGenerateContracts() {
    if (!requirePhase("contracts")) return;
    const count = 2 + playerState.modifiers.extraContract;
    playerState.contracts = Array.from({ length: count }, () => generateContractData(playerState.round));
    playerState.phase = "accept";
    logPlayer(`${count} contract(s) revealed. Accept one contract or skip.`);
    renderPlayer();
}

function playerAcceptContract(id) {
    if (playerState.phase !== "accept") { logPlayer("You can only accept contracts during the contract phase."); return; }
    if (playerState.acceptedThisRound) { logPlayer("You already accepted one contract this round."); return; }
    if (playerState.active.length >= 3) { logPlayer("No shipment slots available. Maximum active shipments is 3."); return; }
    const contract = playerState.contracts.find(c => c.id === id);
    if (!contract) return;

    const normalAvailable = Math.min(playerState.stock[contract.origin], contract.quantity);
    const missing = contract.quantity - normalAvailable;
    const purchaseCost = normalAvailable * cityData[contract.origin].purchase_cost + missing * (cityData[contract.origin].purchase_cost + 2);

    if (playerState.cash < purchaseCost) {
        logPlayer(`Cannot accept ${contract.origin} → ${contract.destination}. Purchase cost is ${purchaseCost}, but cash is ${playerState.cash}.`);
        return;
    }

    playerState.cash -= purchaseCost;
    playerState.stock[contract.origin] -= normalAvailable;
    playerState.active.push({ id: contract.id, contract, location: contract.origin, acceptedRound: playerState.round, moved: false });
    playerState.contracts = playerState.contracts.filter(c => c.id !== id);
    playerState.acceptedThisRound = true;
    playerState.phase = "movement";
    logPlayer(`Accepted contract ${contract.origin} → ${contract.destination}. Paid ${purchaseCost}. Shipment starts at ${contract.origin}.`);
    renderPlayer();
}

function playerSkipContract() {
    if (playerState.phase !== "accept") return;
    playerState.phase = "movement";
    logPlayer("Skipped contract acceptance this round.");
    renderPlayer();
}

function playerMoveAllShipments() {
    if (!requirePhase("movement")) return;
    if (playerState.active.length === 0) {
        logPlayer("No active shipments to move.");
        playerState.movedThisRound = true;
        playerState.phase = "endRound";
        renderPlayer();
        return;
    }
    const shipmentIds = playerState.active.map(s => s.id);
    for (const id of shipmentIds) {
        if (playerState.active.find(s => s.id === id)) playerMoveShipment(id);
    }
    playerState.movedThisRound = true;
    playerState.phase = "endRound";
    renderPlayer();
}

function playerMoveShipment(id) {
    const shipment = playerState.active.find(s => s.id === id);
    if (!shipment) return;
    const select = document.getElementById(`move-${id}`);
    const selected = select ? select.value : "";
    if (!selected) {
        logPlayer(`Shipment ${shortId(id)} did not move because no route was selected.`); 
        return; 
    }
    const [nextCity, routeType] = selected.split("|");
    const route = routes[routeType];
    const movementCost = Math.max(0, route.cost + (playerState.modifiers.costBonus[routeType] || 0));
    playerState.cash -= movementCost;

    let delayNumbers = route.delayOn.slice();
    if (playerState.modifiers.riskWorse.has(routeType)) {
        const extra = Math.max(0, ...delayNumbers) + 1;
        if (extra <= 6) delayNumbers.push(extra);
    }

    const roll = routeType === "air" || playerState.modifiers.ignoreRisk ? null : randInt(1, 6);
    const delayed = roll !== null && delayNumbers.includes(roll);

    if (delayed) {
        logPlayer(`Shipment ${shortId(id)} attempted ${routeType.toUpperCase()} to ${nextCity}. Paid ${movementCost}. Rolled ${roll}: DELAYED.`);
    } else {
        shipment.location = nextCity;
        const rollText = roll === null ? "no delay roll" : `rolled ${roll}`;
        logPlayer(`Shipment ${shortId(id)} moved by ${routeType.toUpperCase()} to ${nextCity}. Paid ${movementCost}; ${rollText}.`);
    }

    if (shipment.location === shipment.contract.destination) deliverShipment(shipment.id);
}

function deliverShipment(id) {
    const idx = playerState.active.findIndex(s => s.id === id);
    if (idx === -1) return;
    const shipment = playerState.active[idx];
    const onTime = playerState.round <= shipment.contract.deadline;
    const earned = onTime ? shipment.contract.payout : Math.floor(shipment.contract.payout / 2);
    playerState.cash += earned;
    playerState.completed.push({ ...shipment, deliveredRound: playerState.round, onTime, failed: false, earned });
    playerState.active.splice(idx, 1);
    logPlayer(`DELIVERED ${shipment.contract.origin} → ${shipment.contract.destination}. ${onTime ? "On time" : "Late"}. Earned ${earned}.`);
}
// #endregion


// #region Rendering

function renderPlayer() {
    if (!playerState) return;

    document.getElementById("roundValue").textContent = `${playerState.round} / 6`;
    document.getElementById("cashValue").textContent = playerState.cash;
    document.getElementById("shipValue").textContent = `${playerState.active.length} / 3`;
    document.getElementById("onTimeValue").textContent = playerState.completed.filter(s => s.onTime).length;
    document.getElementById("lateValue").textContent = playerState.completed.filter(s => !s.onTime && !s.failed).length;
    document.getElementById("failedValue").textContent = playerState.completed.filter(s => s.failed).length;

    document.getElementById("eventCard").innerHTML = playerState.event ? `<strong>${playerState.event.title}</strong>${playerState.event.text}` : `<strong>No event active</strong>Draw an event at the start of the round.`;
    renderInventory();
    renderContracts();
    renderActiveShipments();
    renderMap();
    setPhaseButtons();
}

function renderInventory() {
    document.getElementById("inventoryTable").innerHTML = `<table><thead><tr><th>City</th>
    <th>Stock</th><th>Replenish</th><th>Cost</th></tr></thead>
    <tbody>${cities.map(c => `<tr><td>${c}</td><td>${playerState.stock[c]} / ${cityData[c].max_stock}</td><td>${cityData[c].replenish}</td>
    <td>${cityData[c].purchase_cost}</td></tr>`).join("")}</tbody></table>`;
}

    function renderContracts() {
      const area = document.getElementById("availableContracts");
      if (playerState.contracts.length === 0) { area.innerHTML = "No available contracts."; return; }
      area.innerHTML = playerState.contracts.map(c => {
        const normalAvailable = Math.min(playerState.stock[c.origin], c.quantity);
        const missing = c.quantity - normalAvailable;
        const purchaseCost = normalAvailable * cityData[c.origin].purchase_cost + missing * (cityData[c.origin].purchase_cost + 2);
        const canAfford = playerState.cash >= purchaseCost && playerState.active.length < 3 && playerState.phase === "accept";
        return `<div class="contract-card"><strong>${c.origin} → ${c.destination}
        </strong><div>Qty: ${c.quantity}</div><div>Distance: ${c.distance}</div><div>Deadline: Round ${c.deadline}</div>
        <div>Payout: <b>${c.payout}</b></div><div>Purchase cost: ${purchaseCost}${missing ? ` <span class="status-risk">(${missing} emergency)</span>` : ""}</div>
        <button ${canAfford ? "" : "disabled"} onclick="playerAcceptContract('${c.id}')">Accept</button></div>`;
      }).join("") + (playerState.phase === "accept" ? `<div class="contract-card"><strong>Skip Contract</strong>
        <p>Move existing shipments without accepting a new job.</p><button onclick="playerSkipContract()">Skip</button></div>` : "");
    }

function renderActiveShipments() {
    const area = document.getElementById("activeShipments");
    if (playerState.active.length === 0) { area.innerHTML = "No active shipments."; return; }
    area.innerHTML = playerState.active.map(s => {
        const options = graph[s.location].map(([next, type]) => `<option value="${next}|${type}">${next} (${type}, cost ${Math.max(0, routes[type].cost + (playerState.modifiers.costBonus[type] || 0))})</option>`).join("");
        const best = shortestPath(s.location, s.contract.destination, "Balanced");
        const hint = best.length ? `Suggested: ${best[0][0]} by ${best[0][1]}` : "At destination";
        return `<div class="contract-card"><strong>${shortId(s.id)}: ${s.contract.origin} → ${s.contract.destination}</strong>
        <div>Location: <b>${s.location}</b></div><div>Deadline: Round ${s.contract.deadline}</div><div>Payout: ${s.contract.payout}</div><div class="small">${hint}</div>
        <select id="move-${s.id}" ${playerState.phase === "movement" ? "" : "disabled"}>${options}</select></div>`;
    }).join("");
}

function renderMap() {
    const svg = document.getElementById("gameMap");
    const labelPositions = {
        "Ironvale-Northport": [220, 165], "Ironvale-Centralia": [285, 270], "Ironvale-Westhaven": [110, 360],
        "Northport-Centralia": [365, 190], "Northport-Lakeview": [460, 90], "Westhaven-Centralia": [275, 390],
        "Westhaven-Southport": [285, 485], "Lakeview-Centralia": [520, 205], "Lakeview-Eastgate": [705, 205],
        "Centralia-Eastgate": [585, 285], "Centralia-Southport": [395, 395], "Centralia-Coastview": [590, 390],
        "Eastgate-Coastview": [770, 390], "Southport-Coastview": [585, 515]
    };
    let html = "";
    for (const [a, b, type] of edges) {
        const [x1, y1] = nodePos[a], [x2, y2] = nodePos[b];
        html += `<line class="${type}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"></line>`;
    }
    for (const [a, b, type] of edges) {
        const key = `${a}-${b}`;
        const [x, y] = labelPositions[key] || [(nodePos[a][0] + nodePos[b][0]) / 2, (nodePos[a][1] + nodePos[b][1]) / 2];
        html += `<text class="route-label" x="${x}" y="${y}">${type.toUpperCase()}</text>`;
    }
    for (const city of cities) {
        const [x, y] = nodePos[city];
        html += `<g><circle class="node" cx="${x}" cy="${y}" r="${city === "Centralia" ? 32 : 28}"/><text class="node-label" x="${x}" y="${y + 5}">${city}</text></g>`;
    }
    const grouped = {};
    playerState.active.forEach(s => { grouped[s.location] = grouped[s.location] || []; grouped[s.location].push(s); });
    Object.entries(grouped).forEach(([city, list]) => {
        const [x, y] = nodePos[city];
        list.forEach((s, i) => {
        const dx = -18 + i * 18;
        html += `<g><circle class="shipment-marker" cx="${x + dx}" cy="${y - 38}" r="11"/><text class="shipment-text" x="${x + dx}" y="${y - 38}">${i + 1}</text></g>`;
        });
    });
    svg.innerHTML = html;
}

// #endregion