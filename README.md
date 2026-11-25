# 346 · Topkapı / Blind Dinner VR

Ana sayfa vestiyerli Topkapı Sarayı Mutfakları modelini otomatik açar. Rhino dosyasındaki santimetre ölçüleri metreye çevrilmiştir. VR'da bir metre gerçek mekânda bir metreye karşılık gelir. Venedik Lagünü Atlası bağlantısından diğer sahneye geçebilirsin.

## Gözlükte ayarlar

Meta Quest Browser’da HTTPS adresini aç. Model hazır olduğunda **Enter VR** düğmesine bas. Görüş alanının alt orta kısmındaki **•••** düğmesine elinle işaret edip başparmağın ve işaret parmağınla kıstır veya kumandanın tetiğine bas. Ellerini indirdiğinde başını düğmeye doğru çevirip 1,2 saniye bakarak da seçebilirsin. Seçilebilir düğme vurgulanır.

Panelde **+** ve **−** ile yürüyüş hızını, dönüş hızını ve parmak temas eşiğini değiştir. **Kapat** ile gezintiye dön. Aynı tarayıcıda seçtiğin hız ve parmak temas eşiği iki sahnede de kullanılır. Menü kapandıktan sonra yeni bir hareket başlatmak için parmaklarını ayırıp yeniden dokundur. İki sahne de bu menüyü kullanır.

## GitHub Pages’e yükleme

1. ZIP’i çıkar. İçindeki tüm dosya ve klasörleri GitHub deponun ana dizinine yükle. `index.html`, `README.md`, `assets/`, `js/`, `vendor/`, `atlas.html` ve `model-lab/` aynı seviyede görünmeli.
2. Deponun **Settings → Pages** bölümünde **Deploy from a branch** seç. Dosyaları yüklediğin dalı (genellikle **main**) ve **/ (root)** klasörünü seçip **Save** düğmesine bas.
3. Yayın tamamlandığında Pages ekranındaki HTTPS bağlantısını aç. Aynı adres bilgisayarda ve Meta Quest Browser’da kullanılır. Derleme veya paket kurulumu gerekmez.

## Atlastan VR’a geçiş

1. Bir yıl ve gelgit koşulu seç. **Plan** görünümünde açık bir noktaya tıklayarak başlangıç konumunu belirle.
2. Quest 3’te el takibini etkinleştir. Meta Quest Browser’da atlası açıp **Enter VR** düğmesine bas. VR, seçilen gözlemci konumunda ve su seviyesinde açılır.
3. VR içinde başınla etrafına bak. Başparmağını aşağıdaki parmaklardan birine değdirip hareket boyunca basılı tut.
4. Başka bir yılı karşılaştırmak için Quest sistem menüsünden VR oturumunu sonlandır. Atlas son gezdiğin noktayı gösterir. Yeni senaryoyu seçip tekrar VR’a gir.

| Başparmakla dokunulan parmak | Hareket |
| --- | --- |
| İşaret parmağı | Bakışın yatay yönünde yürü |
| Serçe parmak | Sağa dön |
| Yüzük parmağı | Sola dön |
| Parmakları ayırma veya çelişen hareketler | Sanal hareketi durdur |

Her iki el kullanılabilir. **Hand navigation · Quest / webcam** bölümünden jestle yürüyüş hızını, dönüş hızını ve parmak temas eşiğini ayarlayabilirsin. Yerel zemin referansı varsa göz yüksekliği başlıktan alınır.

## Masaüstünde

- **Plan**, **Section**, **Elevation** ve **Walk** aynı araziyi gösterir. Kesit yönünü **Drawing controls** altında A–A′ veya B–B′ olarak seç. Kesit konumu, harita üzerindeki kesit çizgisiyle eşleşir.
- **Walk** modunda WASD ile yürü, fareyi sürükleyerek etrafına bak, sağ ve sol ok tuşlarıyla dön. **Space** zıplatır. Birinci ve üçüncü şahıs görünümleri ile hareket hızı sağ panelden seçilir.
- **Environmental analysis** bölümündeki yıl çubukları ve gelgit seçimi atlası günceller. Arazi alanı hektar, etkilenen yol uzunluğu kilometre olarak gösterilir. Gözlemci profili seçili noktadaki zemini ve test su seviyesini karşılaştırır.
- Webcam ile hareket etmek için **Hand navigation · Quest / webcam → Start camera** seç. Kamera görüntüsü cihazda işlenir. İlk kullanımda MediaPipe, WASM ve el modeli internetten yüklenir. Klavye ve yerel Quest el takibi kamera modelini indirmeden çalışır.

## Ölçek ve mimari model laboratuvarı

Venedik arazisinin kaynak birimi metredir. VR’da bir arazi metresi bir takip metresine eşlenir. Kaynak atlastaki uzun vadeli su seviyeleri tasarım senaryolarıdır. Model varsayımları, ölçüm kapsamı ve kaynaklar atlasın sağ panelindedir.

## Yerel önizleme

Dosyaları çıkardığın klasörde `python -m http.server 8000` komutunu çalıştırıp bilgisayarda `http://localhost:8000/` adresini açabilirsin. Quest için GitHub Pages HTTPS adresini kullan. İsteğe bağlı jest testleri proje kökünde `node --test tests/gestures.test.js` komutuyla çalışır.
