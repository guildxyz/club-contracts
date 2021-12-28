import { program } from "commander";
import fs from "fs";
import path from "path";
import { utils } from "ethers";

program
  .version("1.0.0")
  .requiredOption(
    "-i, --input <path>",
    "input csv file location containing addresses and balances (in whole tokens, not in 'wei') separated with a comma"
  );

program.parse(process.argv);

const obj: { [key: string]: string } = {};
fs.readFileSync(program.opts().input, { encoding: "utf8" })
  .split(/\r?\n/)
  .forEach((line) => {
    const [address, ...amount] = line.split(",");
    const wholeAmount = amount.join().replace(/"/g, "").replace(/,/g, "");
    const weiAmount = utils.parseEther(wholeAmount).toString();
    const hexAmount = BigInt(weiAmount).toString(16);
    obj[address.trim()] = hexAmount;
  });

const result = JSON.stringify(obj);
fs.writeFileSync(path.join(__dirname, "readyInput.json"), result);
