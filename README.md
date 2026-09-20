# Rin's Web Apps

歴史・資格・ゲームのWebアプリを、夜景上空に浮かぶアクリル展示として一覧・起動するThree.jsベースの静的ギャラリーです。GitHub Pagesでそのまま公開でき、ビルドや外部APIは必要ありません。

## ローカルで確認する

`file://` で直接開くのではなく、プロジェクトのルートで簡易HTTPサーバーを起動してください。

```bash
python3 -m http.server 8000
```

ブラウザで `http://localhost:8000/` を開きます。

## GitHub Pagesで公開する

1. このフォルダの中身を `rin-webapp-gallery` リポジトリのルートへ配置します。
2. GitHubの **Settings → Pages** を開きます。
3. **Deploy from a branch** を選び、`main` ブランチの `/ (root)` を指定します。
4. 公開後、`https://<ユーザー名>.github.io/rin-webapp-gallery/` を開きます。

すべての内部参照は相対パスなので、GitHub Pagesのサブディレクトリ配信に対応しています。

## 新しいアプリを追加する

編集する場所は **`apps.js` の `apps` 配列だけ**です。既存項目と同じ形で1件追加すると、該当カテゴリの末尾方向にアクリル板が自動生成されます。HTMLや `app.js` の変更は不要です。

```js
{
  id: "my-new-app",
  category: "history",
  order: 5,
  icon: "📜",
  title: "新しいアプリ",
  description: "1行の短い説明",
  url: "https://example.github.io/my-new-app/"
}
```

新しいカテゴリを作る場合は、同じ `apps.js` の `categories` にカテゴリを追加し、その `id` をアプリ側の `category` に指定します。カテゴリ列・見出し・横ナビゲーションも自動生成されます。

## データフィールド

| フィールド | 内容 |
|---|---|
| `id` | アプリを一意に識別する文字列 |
| `category` | `categories` に登録したカテゴリID |
| `order` | カテゴリ内の表示順（小さい順） |
| `icon` | アクリル板に表示する絵文字 |
| `title` | アプリ名 |
| `description` | 1行説明 |
| `url` | `OPEN APPLICATION ↗` で開くURL |

カテゴリは `id`（内部ID）、`label`（見出し）、`order`（列順）で管理します。

## 操作

- 板本体をクリック／タップ：選択して一時点灯
- `OPEN APPLICATION ↗`：別タブでアプリを開く
- 上下ドラッグ／スワイプ：同じカテゴリ内を移動
- 左右ドラッグ／スワイプ：カテゴリ単位で移動
- マウスホイール：上下移動（上回転で下の展示、下回転で上の展示）
- 矢印キー：同一カテゴリの上下、カテゴリ間の左右移動
- Tabキー：起動リンクへフォーカス

WebGLの初期化に失敗しても、HTML製のアクリル板と各リンクはそのまま利用できます。

## 構成

- `index.html` — ページ骨格
- `style.css` — アクリル表現、レスポンシブ、アクセシビリティ
- `apps.js` — カテゴリとアプリの全データ
- `app.js` — 自動生成、選択・ジェスチャー、Three.js夜景
- `vendor/three.local.js` — Three.js r170（ローカル配信）
- `vendor/THREE-LICENSE.txt` — Three.jsライセンス
