import { startApp } from "./ui/app";
import "./styles.css";

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("App root not found");
startApp(root);
