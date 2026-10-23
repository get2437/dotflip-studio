const studioUrl=new URL('./',import.meta.url).href;
const examples=[
  {
    title:'イラストから、まばたきと髪の揺れ',
    text:'添付した画像を、DOTFLIP Studio（https://get2437.github.io/dotflip-studio/）をコンピュータユーズで操作して、動くドット絵にしてください。\n\n顔・髪型・服の特徴を保ち、128×128px、24〜32色を目安に輪郭を手直ししてください。自然なまばたきと、髪が風で1〜2px揺れる動きをつけ、2〜3秒で自然につながるループにしてください。顔とカメラは固定し、残像は入れないでください。\n\n再生して顔の崩れやちらつき、最初と最後のつながりを確認し、2倍のGIFと編集可能な.dotflip.jsonを保存してください。'
  },
  {
    title:'連続ポーズから、激しいアクション',
    text:'添付キャラクターの見た目を保ち、画像生成で戦闘用の16ポーズを作ってください。構え・予備動作・連打・踏み込み・ジャンプ・空中蹴り・着地・回避・必殺技・構えを含め、透明背景で各ポーズの間に十分な余白を取り、4×4の順に並べてください。\n\nその画像をDOTFLIP Studio（https://get2437.github.io/dotflip-studio/）で読み込み、透過のまとまりを自動抽出し、同じ縮尺と足元にそろえてドット絵に変換してください。「戦闘シーンを組み立てる」で全力コンボを作成してください。衝撃波はオン、残像はオフ。顔・髪・服の色をそろえ、手足の欠けとループのつながりを確認してください。\n\n元のポーズと完成版の.dotflip.json、完成版の2倍GIFを保存してください。'
  },
  {
    title:'作ったアニメーションを手直し',
    text:'この.dotflip.jsonをDOTFLIP Studio（https://get2437.github.io/dotflip-studio/）で開いて、各コマを確認しながら修正してください。\n\nキャラクターの顔・髪型・衣装を保ち、輪郭のちらつき、動く部分の穴、はみ出した手足を整えてください。まばたきは閉じる瞬間を短くし、最初と最後のコマが自然につながるようにしてください。全体の再生スピードのスライダーで、コマごとの表示時間を均一にしないでください。\n\n修正前のデータを残し、修正後のGIFと.dotflip.jsonを別名で保存してください。'
  }
];
export const PROMPT_EXAMPLES=examples.map(example=>({...example,text:example.text.replaceAll('https://get2437.github.io/dotflip-studio/',studioUrl)}));
