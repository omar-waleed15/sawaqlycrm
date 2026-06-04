"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const supabase_1 = require("./src/lib/supabase");
async function check() {
    console.log("Checking expenses table...");
    const { data: exp, error: expErr } = await supabase_1.supabaseAdmin.from('expenses').select('*').limit(5);
    if (expErr) {
        console.error("Error querying expenses:", expErr);
    }
    else {
        console.log("Expenses:", exp);
    }
    console.log("Checking salaries table...");
    const { data: sal, error: salErr } = await supabase_1.supabaseAdmin.from('salaries').select('*').limit(5);
    if (salErr) {
        console.error("Error querying salaries:", salErr);
    }
    else {
        console.log("Salaries:", sal);
    }
}
check();
