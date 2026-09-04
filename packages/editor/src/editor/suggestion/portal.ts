"use client";

import { createContext } from "react";
import type tunnel from "tunnel-rat";

// 菜单 JSX 写在编辑器 React 树内（portal.In），弹层宿主在树外渲染（portal.Out）
export const SlashCommandPortalContext = createContext({} as ReturnType<typeof tunnel>);
