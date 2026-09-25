
import React from "react"; import { renderToStaticMarkup } from "react-dom/server.node";
import { CyberAvatar, CHAR_MODELS } from "/home/user/tigaalpha.github.io/cyber-avatar.tsx";
import { PetArt, PET_SPECIES } from "/home/user/tigaalpha.github.io/pet-lab.tsx";
const h = React.createElement;
const tree = h("div", null,
  h("div", { className: "row" }, CHAR_MODELS.slice(0, 8).map(m => h("div", { className: "c", key: m.id }, h(CyberAvatar, { model: m.id, yaw: 24, pose: "ready" })))),
  h("div", { className: "row" }, PET_SPECIES.slice(0, 12).map(s => h("div", { className: "p", key: s.id }, h(PetArt, { species: s.id, level: 12 })))));
export const html = renderToStaticMarkup(tree);
