import { program } from "commander";
import fs from "fs";
import path from "path";
import { parseBalanceMap } from "./lib/parse-balance-map";

program
  .version("1.0.0")
  .requiredOption(
    "-i, --input <path>",
    "input JSON file location containing a map of account addresses to string balances"
  );

program.parse(process.argv);

const json = JSON.parse(fs.readFileSync(program.opts().input, { encoding: "utf8" }));

if (typeof json !== "object") throw new Error("Invalid JSON");

const result = JSON.stringify(parseBalanceMap(json));
console.log(result);
fs.writeFileSync(path.join(__dirname, "result.json"), result);
