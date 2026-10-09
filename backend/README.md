

## Wyszukiwanie po zawartości zdjęć

Workers AI opisuje miniaturę zdjęcia modelem LLaVA i tworzy polskie słowa
kluczowe modelem Llama 3.2 3B. Opis jest zapisany raz w metadanych GCS
(`gallerySearchV1`). Wyszukiwanie przegląda zapisane opisy, nazwy i daty
w całej galerii, ignorując wielkość liter oraz polskie znaki.

Nowe zdjęcia są indeksowane w tle po uploadzie. Zdjęcia już obecne trzeba
zindeksować po wdrożeniu Workera z bindingiem `AI`. Wywołaj
`POST /admin/index-photos` z nagłówkiem `X-Admin-Token`; każde wywołanie
przetwarza najwyżej 3 zdjęcia. Powtarzaj, dopóki `remaining` nie wyniesie 0.
Odpowiedź zawiera `indexed`, `remaining` i `failures`. Przy błędach przerwij,
usuwając ich przyczynę przed ponowieniem. Istniejące opisy i filmy są pomijane.

Inferencja korzysta z konta Cloudflare i jego limitów/rozliczeń Workers AI.
Model nie rozpoznaje tożsamości osób; analiza dotyczy widocznych obiektów,
kolorów i czynności. Wyszukiwanie filmów nadal korzysta z nazw i dat.
Po pierwszym indeksowaniu odśwież otwartą galerię, aby pobrać nowe opisy.
