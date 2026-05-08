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

