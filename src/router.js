import { createRouter, createWebHistory } from "vue-router";
import Login from "./views/Login.vue";
import Docs from "./views/Docs.vue";

const routes = [
  { path: "/", component: Login },
  { path: "/docs", component: Docs },
];

const router = createRouter({
  history: createWebHistory("/frontend-ssr-editor/"),
  routes,
});

export default router;
