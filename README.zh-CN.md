<!-- Allow this file to not have a first line heading -->
<!-- markdownlint-disable-file MD041 no-emphasis-as-heading -->

<!-- inline html -->
<!-- markdownlint-disable-file MD033 -->

<div align="center">

# `☯️ fate-graph`

**把《易经》六十四卦画成一个可以旋转的球，每一卦都配有讲解**

[![Build status](https://github.com/frankie137/fate-graph/actions/workflows/ci.yml/badge.svg)](https://github.com/frankie137/fate-graph/actions/workflows/ci.yml)
[![在线访问](https://img.shields.io/badge/在线访问-GitHub%20Pages-blue)](https://frankie137.github.io/fate-graph/)
[![License](https://img.shields.io/badge/license-MIT%20OR%20Apache--2.0-blue)](#许可证)

[English](README.md) | 简体中文

**[打开在线页面](https://frankie137.github.io/fate-graph/)**

</div>

![墨金配色下选中泰卦的页面](docs/screenshot-ink-gold.jpg)

## 简介

fate-graph 是一个学习《易经》六十四卦的网页。页面把六十四卦画成一个可以旋转的球，每个卦是球面上的一个节点，点击节点可以阅读这一卦的讲解。

## 功能

- **可以转动的球。** 拖拽旋转，滚轮缩放，点击节点选中一个卦。
- **在球上标出卦与卦的关系。** 选中一个卦之后，实线标出只差一爻的六个变卦，虚线标出它的错卦、综卦和互卦。
- **六十四卦都有讲解**，分成五栏：
  - 入门：这一卦讲什么、现实中的启示、生僻字；
  - 原文逐爻：卦辞、彖传、象传和六爻，每条都有白话和讲解；
  - 图解：这一卦的传统木刻卦图；
  - 倪师讲解：倪海厦讲解的要点摘要，附出处；
  - 卦变：错卦、综卦、互卦和六个变卦，点击可以跳转。
- **搜索。** 支持卦名、卦序和拼音，例如 `屯`、`3`、`zhun`。
- **卦序表和新手指南。** 卦序表列出全部六十四卦，新手指南介绍爻、八卦和六十四卦的基本概念。
- **两套配色。** 墨金（深色）和宣纸（浅色）。

![宣纸配色下的页面](docs/screenshot-rice-paper.jpg)

## 球的结构

球上节点的位置按三条规则确定：

- 节点的高度由阳爻的数量决定。六爻全阳的乾卦在顶端，六爻全阴的坤卦在底端，其余的卦分布在中间的五圈上。
- 两个卦只有一爻不同时，它们之间有一条连线。每个卦有六条连线，整个球共 192 条。
- 每个卦和它的错卦（六爻阴阳全部相反的卦）位于球的正对面。

每一圈内节点的先后顺序由 `src/domain/layout.ts` 计算，计算的目标是让连线尽量短。

## 本地运行

需要 Node.js 24 或更高版本。

```sh
npm install
npm run dev
```

`npm run dev` 启动后，终端会打印本地地址，在浏览器里打开这个地址即可。

| 命令 | 作用 |
| --- | --- |
| `npm test` | 运行单元测试 |
| `npm run build` | 做类型检查，并把网页构建到 `dist/` 目录 |
| `npm run fetch:classics` | 重新从中文维基文库下载《周易》原文 |

每次向 `main` 分支推送代码，`.github/workflows/pages.yml` 都会构建网页并发布到 GitHub Pages。

## 内容和来源

| 栏目 | 文件 | 来源 |
| --- | --- | --- |
| 入门 | `src/content/guide/NN.json` | 为本项目撰写 |
| 原文逐爻 | `src/content/classics/NN.json` | [中文维基文库](https://zh.wikisource.org/wiki/周易)的《周易》 |
| 图解 | `src/assets/tujie/NN.jpg` | [finalhopes.com](http://www.finalhopes.com/yijing.html) 各卦页面上的扫描图 |
| 倪师讲解 | `src/content/ni/NN.json` | 倪海厦《天纪》讲解的要点摘要 |
| 卦变 | 无 | 由 `src/domain/hexagrams.ts` 计算 |

文件名里的 `NN` 是两位数的卦序，例如 `03` 是屯卦。各个 JSON 文件的字段定义在 `src/content/types.ts`。

阅读这些讲解时，请留意下面几点：

- **原文。** 维基文库《周易》的底本有几十处用字和通行本（王弼本一系）不同。`scripts/classics-corrections.json` 列出了这些地方，下载脚本会把它们改成通行本的写法。
- **入门讲解。** 入门讲解是借助 AI 助手起草的。它依据王弼、程颐、朱熹一脉的通行解释，各家说法不一致的地方取最通行的一种。目前没有人对照纸质书逐条核对过，欢迎指正。
- **倪师讲解。** 这一栏是转述的学习笔记，不是倪海厦的原文。内容整理自网络上流传的转录稿，每一卦都列出了所依据的页面。来源缺少某一部分时，这一卦的 `note` 字段说明了缺少的内容。如果你是相关资料的权利人，希望修改或删除某一条，请提交 issue。
- **图解。** 每张图都是一幅印刷木刻画的扫描图。这些扫描图从 finalhopes.com 下载，下载后经过裁剪，每个文件只保留木刻画和印在画旁边的卦名。第 15 卦谦的图旁边没有卦名，因为这个网站只提供了这一卦不带卦名的扫描图。这个网站没有说明扫描图出自哪一本书，也没有给出这些图的许可证。如果你是某张扫描图的权利人，希望修改或删除它，请提交 issue。

## 代码结构

| 目录 | 内容 |
| --- | --- |
| `src/domain/` | 六十四卦的数据表、卦与卦之间关系的计算、球面布局 |
| `src/scene/` | 用 Three.js 绘制的三维场景 |
| `src/theme/` | 配色方案 |
| `src/ui/` | 搜索框、讲解面板等页面部件 |
| `src/content/` | 各卦的文字内容和读取这些内容的代码 |
| `scripts/` | 下载原文的脚本 |

## 参与贡献

[![Contributor Covenant](https://img.shields.io/badge/contributor%20covenant-v1.4-ff69b4.svg)](CODE_OF_CONDUCT.md)

欢迎社区参与这个项目。

开始之前请阅读[贡献指南](CONTRIBUTING.md)；提交任何贡献之前，请阅读其中的[贡献者条款](CONTRIBUTING.md#contributor-terms)。

凡是有意提交到本项目的贡献，都按下面的双许可证授权，不附加其它条款。

### 许可证

本项目的代码采用双许可证，你可以任选其一：

- Apache License 2.0（[LICENSE-APACHE](LICENSE-APACHE) 或 <http://www.apache.org/licenses/LICENSE-2.0>）
- MIT 许可证（[LICENSE-MIT](LICENSE-MIT) 或 <http://opensource.org/licenses/MIT>）

`src/content/classics/` 目录下的文件来自中文维基文库。维基文库的文本以 [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) 许可证发布，这些文件适用该许可证。

`src/assets/tujie/` 目录下的图片从第三方网站下载，这个网站没有给出这些图片的许可证。上面的双许可证不适用于这些图片。
