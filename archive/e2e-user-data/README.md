# Electron 端到端 userData 归档

这些目录是本地跑 Electron 端到端脚本时隔离出来的 `userData`（缓存、SQLite、图片等），不是业务源码，也不应进 Git。

| 目录 | 原仓库根目录名 |
| --- | --- |
| `default/` | `.e2e-user-data` |
| `final/` | `.e2e-user-data-final` |
| `followup/` | `.e2e-user-data-followup` |
| `mock/` | `.e2e-user-data-mock` |
| `release/` | `.e2e-user-data-release` |

可随时整夹删除。脚本若再生成根目录 `.e2e-user-data*`，`.gitignore` 仍会忽略。
