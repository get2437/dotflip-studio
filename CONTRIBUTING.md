# Contributing

バグ報告や改善提案は [Issues](https://github.com/get2437/dotflip-studio/issues) にお願いします。再現手順、期待した動作、実際の動作、ブラウザとOSを添えてください。個人の画像や認証情報を公開しないようにしてください。

Node.js 22以降を使用します。

```sh
npm ci
npm run build
npm test
npm start
```

UIは `app/app.js`、純粋な画像処理は `app/core.js`、透過抽出とアクション演出は `app/action.js` にあります。機能を変更するときは、その動作を確認できる検証を添えてください。`dist/`、`node_modules/`、個人のサイト設定はコミットしません。

コントリビュートするコードや素材について、MITライセンスで配布する権利があることを確認してください。AI生成素材を追加する場合は、その出自と使用範囲を `ASSETS.md` に記録します。
