import React, { useState, useEffect, useMemo, useRef, useCallback, useDeferredValue, memo } from "react";
import { Mail, Upload, Key, Package, Truck, Users, DollarSign, LayoutDashboard, Settings, Search, Plus, LogOut, MapPin, Plane, Ship, CheckCircle2, Clock, AlertTriangle, X, User, Lock, Shield, ChevronRight, ChevronLeft, Printer, Trash2, MessageCircle, Camera, Navigation, Globe, Sparkles, Download, RefreshCw, PenTool, ShieldCheck, Receipt, FileStack, Sun, Moon, Menu, Eye, EyeOff, Check, Bell } from "lucide-react";
import { storage, subscribeToChanges, flushOutbox, pendingSyncCount } from "./lib/storage.js";

/* ---------- design tokens ----------
Identité : Navy #0A2647 · Rouge de marque #C8102E · Blanc #FFFFFF
Titres : 'Space Grotesk' | Texte courant : 'Inter'
------------------------------------- */
const FONT_LINK = "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap";

/* ---------- Système de couleurs ----------
Toutes les couleurs d'interface passent par des variables CSS définies deux fois (thème sombre et
thème clair) dans le <style> du composant App. Ne jamais écrire une couleur en dur dans un style :
un encart codé en dur reste sombre sur une page claire, ce qui était le principal défaut visuel
corrigé depuis.

  Surfaces        var(--bg) · var(--surface) · var(--surface2) · var(--border)
  Textes          var(--text) primaire · var(--muted) secondaire
  Succès          var(--ok-bg) · var(--ok-bg-soft) · var(--ok-border) · var(--ok-fg) · var(--ok-fg-alt)
  Alerte          var(--warn-bg) · var(--warn-border) · var(--warn-fg) · var(--warn-fg-soft)
  Erreur          var(--danger-bg) · var(--danger-border) · var(--danger-fg) · var(--danger-fg-soft)
  Information     var(--info-bg) · var(--info-bg-alt) · var(--info-border) · var(--info-fg) · var(--info-fg-soft)

Trois valeurs sont volontairement FIXES car elles s'appliquent sur la barre latérale, qui reste
bleu marine dans les deux thèmes : var(--nav-fg), var(--nav-muted), var(--brand-on-dark).
var(--brand-solid) est le rouge de marque destiné aux fonds pleins avec texte blanc (contraste
suffisant, contrairement à l'ancien #E23F52).

Exceptions légitimes aux couleurs en dur : les PDF et le canvas (jsPDF ne sait pas résoudre une
variable CSS), et les pastilles d'icônes qui reçoivent un fond plein via la propriété `tint`.
------------------------------------- */
const BG = "var(--bg)", SURFACE = "var(--surface)", SURFACE2 = "var(--surface2)", BORDER = "var(--border)";
const TEXT = "var(--text)", MUTED = "var(--muted)", BLUE = "#3D63FF", RED = "#E23F52", GREEN = "#2FAE73", AMBER = "#E0A63A";
const FLAGS = { FR: "🇫🇷", BE: "🇧🇪", CA: "🇨🇦", US: "🇺🇸", US2: "🇺🇸", MA: "🇲🇦", GN: "🇬🇳", DE: "🇩🇪", IT: "🇮🇹", ES: "🇪🇸", SN: "🇸🇳" };

const COUNTRIES = [
  { code: "GN", name: "Guinée", city: "Conakry", air: 0, sea: 0, delayAir: 0, delaySea: 0, currency: "GNF" },
  { code: "FR", name: "France", city: "Paris", air: 12, sea: 6, delayAir: 4, delaySea: 35, currency: "EUR" },
  { code: "BE", name: "Belgique", city: "Bruxelles", air: 13, sea: 6.5, delayAir: 5, delaySea: 37, currency: "EUR" },
  { code: "DE", name: "Allemagne", city: "Berlin", air: 12.5, sea: 6.2, delayAir: 4, delaySea: 35, currency: "EUR" },
  { code: "IT", name: "Italie", city: "Milan", air: 13, sea: 6.5, delayAir: 5, delaySea: 36, currency: "EUR" },
  { code: "ES", name: "Espagne", city: "Madrid", air: 12.5, sea: 6.3, delayAir: 5, delaySea: 36, currency: "EUR" },
  { code: "CA", name: "Canada", city: "Montréal", air: 15, sea: 8, delayAir: 6, delaySea: 42, currency: "CAD" },
  { code: "US", name: "États-Unis (New York)", city: "New York", air: 16, sea: 8.5, delayAir: 6, delaySea: 40, currency: "USD" },
  { code: "US2", name: "États-Unis (Atlanta)", city: "Atlanta", air: 15.5, sea: 8, delayAir: 6, delaySea: 40, currency: "USD" },
  { code: "MA", name: "Maroc", city: "Casablanca", air: 10, sea: 5, delayAir: 3, delaySea: 20, currency: "MAD" },
  { code: "SN", name: "Sénégal", city: "Dakar", air: 8, sea: 4, delayAir: 2, delaySea: 10, currency: "XOF" },
];
const CURRENCIES = { EUR: 1, USD: 1.08, CAD: 1.47, GNF: 9500, MAD: 10.9, XOF: 655.957, GBP: 0.86 };

/** Logo officiel Ba-Diaby Express — utilisé par défaut dans la barre latérale et sur tous les documents PDF (facture, reçu, bordereau, étiquette, bon de sortie). */
const DEFAULT_LOGO = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMgAAADKCAMAAADXTv+nAAABCGlDQ1BJQ0MgUHJvZmlsZQAAeJxjYGA8wQAELAYMDLl5JUVB7k4KEZFRCuwPGBiBEAwSk4sLGHADoKpv1yBqL+viUYcLcKakFicD6Q9ArFIEtBxopAiQLZIOYWuA2EkQtg2IXV5SUAJkB4DYRSFBzkB2CpCtkY7ETkJiJxcUgdT3ANk2uTmlyQh3M/Ck5oUGA2kOIJZhKGYIYnBncAL5H6IkfxEDg8VXBgbmCQixpJkMDNtbGRgkbiHEVBYwMPC3MDBsO48QQ4RJQWJRIliIBYiZ0tIYGD4tZ2DgjWRgEL7AwMAVDQsIHG5TALvNnSEfCNMZchhSgSKeDHkMyQx6QJYRgwGDIYMZAKbWPz9HbOBQAAAAYFBMVEX///////39//7//v7//P37+/z48/Xt5+rs09XLzdTEuL3cmZ6dobCFh5OyaHBma4NTWXpESmnDGiTXCRTlBBBlMEYyN2UyNWwyMzgvNmkuNGkuNWMuNFosMWErMFIYGhqZdO7hAAAU4ElEQVR42u1dCXujOBIFhCQkIwuSDARz9P//l/uqBBh8JOkeSHrno3YnNphDT3WXjo7e/yMUyf8IRQcddNBBBx100EEHHXTQQQcddNBBBx100EEHHXTQf4SSJErTVHz5+jj+O3EImQgQ4HwVNt2E/9NNAh9/C5BUKp1p9WUgcYrrQRb/aSV+h5f7MiTVp/PL+ZSpFL39sdTESZKq7HQ+v4x0Dvf9HQwxaNbrKxp10kpOfIkfABaCUdDVRG/0B7dlfwlHUouWvb29oU0vJ8hKHEmZPGJcChiM4m2igAMq9ncAUaeXl7FdryxicXKvwTFwZKcAeYHjnCko/N+i7ik6+nXZxxoKvGqcAJBbGG+EGiYi/XltV9oYY6010RVJ6GdiSyxmZYljSQZhBeONdCqNZPqj/Ei0yZ3zZdV13TB0NglIXue+DlgEuYtIxDHDWEkV6ZNKf8qLsEsWAOHLrutBLVNX5VKtWxrYolVKXl9lN9zAr4CR/KRyJNo6gBi69nKpQVXVXNq275yCyq9FZxQxeQ+D1EhJ+UPKQb2njCuHYejR+ktT1y140vUkW93g9RrJ66T5pwc6TqaKwproZ3Do3APEpb60VQUMUI+qLLx3IO9Lp+94MmK5M1VZpqKfs1Q6L9D1bVXXl34ABJ9bY+DKZYTeTRBuKTiK0aE8JdZxC6v7Q9ohGEZfgRMt9AMgjH4wZSeBQ3l9fX2KYoSRQ0F+IJKPBYy9LcCLy4VglM4yCDELR/AUbNDSW8W+9eNZ7jKEW1kqfwBJmrlugJVq2q7zuX6YGcULnnwA43S25OBfzlYm3y5VMi9hltrmMnTeqM+jldcnME4BBoWNAKK+GUYcadf1F/Z63iTRB544RrIhs4eSNel4lnEigi/pt+cgBtpBMLrCyijhFPUZZopEHuAIOp4tYJCt+1bzi1gvLwlHP5S5WmjGyJaVU0uQKT7SdPbjqUReexphwKPH35uCxMoNPXGjc3ql4SwYkKTkWnFIkscWi/04mq4nGPIHPIj2HXxHC3bIdeoqOJ/i2kEaBxjJE78OU6XhLUnHGUb67eYqSbTv2XN4M7qJZR0kC01DKIWAA/HfAxzBVFlnOcMlzjAPv9t7gB9DUwMHxCpeAEEKoacKAie3Ac69WAVT5fJsgiGMjtLvxUD6ABzdpe4GiJVYoACM020FgdG8PoCR5XnQcQrbETkX+vszKOCo4c2RMt3IQsyVkDspurO45MdPGfOOckHjKZsEkuR79UMBR133pU1uDeVU1Pkoxg3hSG4nGDBwphwuddN5nXxnvJhI14EbjOMuCEnjWN2m4LeOg3WclOM8ZuYSSPr6Ug1OfSuQvOvruqtsEifrCDFmbY9TfXoS5o6mKic//g/D4DIJPA8haaBzyTcKlylb5LHQj6e9h0z89CCLGsORCYZOrwUGEdmyvyCxtJwdfgtbdNGR4c0/WO8gEC1lpw9M1ZlCqqX3Q8vB56puSx19k3NPHbKoz6RZpCnVR+4qoJAqhmERUsXr7CmWbmjrevDfk+hCBDhOLPSHWkmltUSdX29hIH+0DIOHceKlCMFIeCRo7ZDvD4RKg7rs6ktfmk9HyJIFkEnHrUYya8cI7EG0gGC660qzv+USKfO/gXH5PGNAoPi6Ug5LCmIo9HrWUFu1bdV5tX/omJgODIEcfyV9TAOQWce1teQ25FNrJ+Cg2kvT2f1tsPRd1YL50deAvEwVUJsbnRkqbn08AAeL2F6ggPsCQUeSpsNrReJzGykEgITBmlRqpTQMlUw/CUdhgxHCdfneQFQxtO1QqK+YeljgU8hdOdH6WuoHy9VfEMTpXX1iLG1XNf1gv2gYUhtgfFSUuA8bqpqNiYh2dIwKPr35kqYHIJAm8bv1EOn6pgFLdhUu9oWd/erlgJD8/pgTR49Qwx2diITnbTv/r0rM8RdYglyn83vWGuFDKmLIzo7XdHC5ndlN3UWUDwgWYbJ2DiCUhyZ2LtlT1QEkT/7NamV4k88vQoc1e4bzpoJklebPgBAXlcmLrnCf1uwRO7II7wIEDXE8qin/ULIkoRho4L0rciOjjwreiLiawe1VPYVXH6is+Fh/1jXT2yZInftqGPrm0iAH6IbKByxPzXzfdKXezZhw0V08LKusz66H+lNtfTmgkyug4PH3BlhKb/WT0YOEc57O7GWzOqfFQ0dNo7YUFIKMMVDnRMnrCKJyJYlUWzOFiQTA0/dDiQc+ibGh7oPbyfpaM4W8aHaYL5ODwji6L4qSyDuHM8Y5teRk3zbNJYBgIBemfhjMU7sFJfG7bOZAE8MkSUxiHLW6oukyI3X9gIOqYEwldMHlhZoCf3KjfV2W9ShWzJCmLIq6fQ7EVO1uSpKOoza6hNLyxAZQO06d6bsSGAqeS4M4v9STKuMeQ/MfyvqCdhNnoCB9h1C98K54mqDpoq9bKMk+1fmEkRh4xZrFCL16pTxn2araCqjQ02MJMmEOlhcAqFzuSeNbnzuk5n1fwqXIx1YYStJUnL/tIVyJZM1wE3kmhgFQpCATFeQ1CUiYLdT3JE6FBDfb+gKJQTu7nsbsyHSJe4M9RkNuFyBCaMczyXimRj9TG4SLZjP5Et/ALu8dDVVHytJsoa4qStLyKrfgxOVSOZvDdeNBBT2OpkpEd5NokDBU3T7aDrmloU9obNVAPgI1ZI3IAo1ASHJIgSAVyjh48r6q+lwbQtKSWajKmuY9VXXTVkbl0DLy9DdRS8zaXnVkMbYPUEkcIA9hEhY3djRZVECtWD/KumWThIucpXikh1LXvTMWzSIfWDgy2B7Chr6ocuPAXpKwvipyeRNuAUip9xAtw4FSFZTch3lY1CxrDXtBbTxwjkBaz+wrcsr2AJTVAT4HxhmuhrEQX4CnLfOip5F6Ha+B9NX29jeGgkhLE7CMXpBhsjY4RpiiDs6iZwPV+6IdgUC2oA1oPKwtbPTg8BkOacZg2wFIV136GyCqAJBq+yBFRMbPloqdOHp5WFPX8Y81gLR9Ufb9aBIQIDIKxIkqsqw94AgxKOeBQ3CGgaycFhUCu+2jLSGNf+8m3xHkirmQ20DMGx8m/bUEpCxbng4Y2kvNDlPR7HtOdllmfHIUsu4OSJK4kJJszo/cQZYQGSraz+pJZdY5i972PJxVlv0wC1TJKMQVSBwie+oXvqTu+1t9cH1TbQ5EWhieu+op/1lMFZDeAwhECE6vB+MCCjKtzsyjziNHgvnwPEW4dGwFHgPZ1vrqrjD2C/aZgVQestUXLFCFNwoQ3DVrJR25ApHIZLQvWWH0ulrk+np7IGYorPlNIAV5bOPQ0lQ4M5s/AjINzQOISJOIBrFcWc5eMfzqhmYXIPnnQBQB0QSkrsFCqnkCCPX/BARfTWGjaRTHeM4kneW6BEVr08ROnM3J02ytIwY57ue+SRUEpKx8X9VjmDQBsZNa6dxdn2Q8dz4JnkA36GDJcmaMTJDlb67slpLSLwCpWLTgqKsFEABAU6WM2U6hm0sO3olfPh2BkB56HSxZ8Y4L+G3K6B2AqE9rt8i4vLXFBVFUcwcEP1uKsSi2GipPAS+J1ggkDkCEjGxOweY7CRkNRqQbW63cO/nUV0oV4hVX8Qx/GF9S9gkIjUHnRnMojKCXSihIIXmeswkV9ysQ6jPHrODsJtfbr1cw8Ap2QcGtT2UHDlnIi1N20lLIzkDi0CxJRqkCQgTJDQWVLef7XeGDajvYsXgJJJUwD7hpl6TdraKq8ROBFP1FIN8ShLKgdQpN0QYg6MzMhlUxPcLcReWhQUbTUATDs+gtu8srkDhOI64DusHsAQStHdOpcaHOmCBSStVe8KUDELSx9n3DVkvS+iRwagglrbmGMgGixRlDF8AkkXJXINCqnYBAzIduTAorEpExlSqvRYiSgPToagDpm66wIRzs6MyiMrcgPIhSTWIvwkcb5AxAYIul3w9IGWoNi6rDXHmgD+86AkIwHVgGzz5wZaiZ5OkORw3rFv6CtwOlj0CDGJotSADyvgcQ75Y8mBjBn1XfwgoNI5AirymlKnrO5Ov6CT+uxFXH5sLpc0XhsIXe6JEjm6fssFMQrpDk+hVHkBW2NFCA3ixIe6oc6XYfgDxv/TNQYU0TcSfHK5XYGkhstMqrrh/zqqVgQTv6MM9VUzWo7RzlVAFI/QcE9aO6MCx0abevPcTGau2GviruCbaMes85nvDflq6aOLKUnvq5sjwgqNZQmGSHYpChPM8PBMSvcUBFXPAybJZ7V0DFnwG5fKgtV6JRcH0zU32bIMWT5Obl0FZrPSlgY4u86oOPgQEqPBe1b4HUM5C+vXzOj6Zzapd6aQ4EkBdahUQ+pONKVaCBOEV2tkGu3jYef6pb0Zpb2NYwCJ/yBEFMvtNG13l/Id/lTJ6vqidc6soHLvleyqKuvA8Ovyge9DzCxfILQCqaibvTQGg+xlXO3NTnSMu7MNjT1+QYg5sv/UOOVCR5H6s7TcSt7G7rjW1JHp1iDnaBk1R1YdiqYCYVxImhcCWN4NwCCa1fAnnwM2NtgCPaaWkS4nFOlAxSceQd3SRYRYfDfAjjTrLg2qIHKlfPOtLMg58jEDcCWbnLy3REQxbAsd8kEdNZkiZPGFwZCovG8KEfCj7Iq/ZSNb13gFrcKvvY0gsDqesnQMiOtF2+34QzATeCfubsqecEiTx4GywX4veKamye7BkBKXDlACANjO3MjpFg+Pq2oTr38uxEMBn9/YqUjf0h4t7gLaoxK7mw4widWEGBCk6vau87KFMfgIx8uDYUQGgA9fKI2J/StEwR7zePSndsl0JKdWEsYWyqH3MsHiJoKKL3sAvgSMn1+bFMzxaZj4o8ZJb3FK51at9/KUGXYfCwphxi4Q3XVDoaDzU0wOvyJ2TyD0mLfYHweC6UuMgp0nLmMYETpa+c1+rP54TvPKlNjN4EDaXw+mmthYaoy09mH8c/hmJ6hUi1oaDkwUzWsO5eKB5E+XJ4EX8PjDjmvbrWW8V8RWI+DS8WFzy9dlNfQhFPut7WYxys+r3Oe74zyP20qfnSJIm22aeGNs9ImXjjG4Ci9TcxU/rR2uBYypQmE8Vc8IxjGdOuZWhyGtoXp3HEqw15R61lH8l03NaF1+ziU24yqUZmpytlOjQ9VpYOtXyuCLR4b3UnmkePop3LxPjUDE+LaSOqK1kt+dlZCgxJTD9ZtUk0n84bqPFS84ylKs746KTCGruHIiayl/WdtHPQy4tOiAHjNgLUL7QsY3WdOv3DL4qAHJf9c1KbaEp65h3XmGgZCI0GCt7MCEfZB3VyAHkdlxq/8OZgiu560TR3jZeUvL2+cBvD+pLFGxjwWae8GcHLuGDj31utM+2qFAjvOauYdtHgV9PRB8ty6KIz3XY+n1/Q6kzRozLwg+5/4/s1A8HB4g1aMoAz75jEgDbiCL2dk8GMHw8J5xad+IcPlkHR5RA+qUhE0NYRCN1PLTxxd0PlUz6a3oDOkbz2+uXEOEhZoq2AvIY9BokNp3Rs4jn010IRx3B1jFmFYCBs3RJJ105AksCrjJ+iGchbWLnPonUiq5XRvih0lG0WdAHI2+skwHh9GifM+SwN7UqnvdeEZEuWjaopAkfSaFpmNQFJeLsw8EqdXllLBK2Km1+BM8moRIxqs113WLTOgUIXxqycJPuQl7Mad5GDST4HS7YCEpqxBCJkNt9PPSNJR14Xb8giWhhLS3zxMCm3KkAEHaH5JzAi9DUmgR+NERmeUbZiBkIdGl2BvJKO0PBieEi4n1eKjvejrTI+TW8ITLI0p1vyLXBUcqvtatKV1YLKxgtrySyazJsi83S2k44wkJmXV6vF90+S9EYsYWW/vsGyfycgpEEi3YwjL2+zlafmsB6O7z1P6s/BRcp8i5fmd0FnzbqRBecw3s8sXPkRMgcU3zGQLRcmrT07v5ZdOpkjMi5XlohrKD9yZO2xU1aisN+GjmkzBQ4Q/slON2+gaIF87su2QFaRUKb4GKEFOZAkRE9PItoQj82xFu38R4FTFiKphOwyn9HZKihTXF/kn7ItE16I6HLnFo6CgWD2Us924uWQVlC3s9nhSfW0HVLKDxNiZmKcyhBMi0Bh34QxZt40tUoooGbiV+MjScJCT9riSKxXrcbX7EFcc4uQnDE6tDAJycm42RPieQ7b0+lUss4496tAiAcJ3Bcty8qShizko3pJvGnuq5cVEkWhLz4zHZrPS16oK9V8CTIPnhou9OLUqEdy+SwdPIQy8+CEur5zOqe3UxP369f7r5HeMwKCM79oWZ2IDH55550/7K/5mvfCpDLcOJ8qLTdIz08C+TAsWV7PjesvpLueencq3g7IlQybI0/NgJXM6IU5i7ZdXlVywrW68Ze5A1IyP8rlRWHq1upZv+yGHPk1rxHJWKBUQS+VmhrhgobSy9951OR9ajXfOJ9yE5D3ogz/44V5fIYHKHL6pqYbPZ9z041bidbk80IZgPbJoDcQY5y8ArEUV8l86kW6MaOYXNpJkKjZbmG4I2bquK7COpfzwgQ380E55zbiiODHTote7GRP9SgR8+pmO7/cLoGEHshWHJkepslssbBNE7tzzR2VM3fDsLGzG6lIuhJ1f62LBlWcV9JS810YwFoA+RVGtfx0aqUjYYTLL/UhLC4zy6uggxvqyPTPO7vJaajx/fMCVHuv2StlD7MhGcj0MMMuUjvoENOk2SK1fnGqVFvqiBppPMc4gg4LdtxrIF7dAQkz4wiIn57FwY2Glhs+1MxB5gjtZcNrM005GYCNgMwD6nqBQ7MI5HI2meNcCIi6mI0Pa0M5NZGAFPOUSLITJKI+1DZmIKzsoRixMZClURdSsFy/Z3HMbMjZj9uVxRdrZTes7OmtH5FrYZudRv5rea7cC4jQjMOQ8eJX8vwEe++66MbsEyBCunuZzJZXvW+2f8V1xSGIGmboCy/XFMIGOxoJM/64sHf0W+CIZsstgl+YKWcgyl7nFE7zzLN8PuXMVsWHmzWOYgpa03SKX/mkuAuBxU1ULB4OfjxqZvp74yx/MKA3JhXLdEIwioBEPBgQiZ+P3IhnYyJidf2W81H+0n8t57dHPxdA4tvETcRfyKrEl8bS/v+766CDDjrooIMOOuiggw466KCDDjrooIMOOuiggw466KCDDvqb6H/eMpeqcoxB7QAAAABJRU5ErkJggg==";


// Liste des indicatifs téléphoniques internationaux (nom, drapeau, indicatif), pour garantir que
// chaque numéro saisi (expéditeur, destinataire, compte utilisateur) inclut toujours l’indicatif
// du pays — indispensable pour que les liens WhatsApp et les tickets envoyés fonctionnent vraiment.
const DIAL_CODES = [
  ["Guinée", "🇬🇳", "224"], ["France", "🇫🇷", "33"], ["Belgique", "🇧🇪", "32"], ["Allemagne", "🇩🇪", "49"],
  ["Italie", "🇮🇹", "39"], ["Espagne", "🇪🇸", "34"], ["Canada", "🇨🇦", "1"], ["États-Unis", "🇺🇸", "1"],
  ["Maroc", "🇲🇦", "212"], ["Sénégal", "🇸🇳", "221"],
  ["Afghanistan", "🇦🇫", "93"], ["Afrique du Sud", "🇿🇦", "27"], ["Albanie", "🇦🇱", "355"], ["Algérie", "🇩🇿", "213"],
  ["Allemagne", "🇩🇪", "49"], ["Andorre", "🇦🇩", "376"], ["Angola", "🇦🇴", "244"], ["Arabie Saoudite", "🇸🇦", "966"],
  ["Argentine", "🇦🇷", "54"], ["Arménie", "🇦🇲", "374"], ["Australie", "🇦🇺", "61"], ["Autriche", "🇦🇹", "43"],
  ["Azerbaïdjan", "🇦🇿", "994"], ["Bahamas", "🇧🇸", "1242"], ["Bahreïn", "🇧🇭", "973"], ["Bangladesh", "🇧🇩", "880"],
  ["Barbade", "🇧🇧", "1246"], ["Bénin", "🇧🇯", "229"], ["Bhoutan", "🇧🇹", "975"], ["Biélorussie", "🇧🇾", "375"],
  ["Birmanie", "🇲🇲", "95"], ["Bolivie", "🇧🇴", "591"], ["Bosnie-Herzégovine", "🇧🇦", "387"], ["Botswana", "🇧🇼", "267"],
  ["Brésil", "🇧🇷", "55"], ["Brunei", "🇧🇳", "673"], ["Bulgarie", "🇧🇬", "359"], ["Burkina Faso", "🇧🇫", "226"],
  ["Burundi", "🇧🇮", "257"], ["Cambodge", "🇰🇭", "855"], ["Cameroun", "🇨🇲", "237"], ["Cap-Vert", "🇨🇻", "238"],
  ["Chili", "🇨🇱", "56"], ["Chine", "🇨🇳", "86"], ["Chypre", "🇨🇾", "357"], ["Colombie", "🇨🇴", "57"],
  ["Comores", "🇰🇲", "269"], ["Congo-Brazzaville", "🇨🇬", "242"], ["Congo-Kinshasa (RDC)", "🇨🇩", "243"],
  ["Corée du Nord", "🇰🇵", "850"], ["Corée du Sud", "🇰🇷", "82"], ["Costa Rica", "🇨🇷", "506"], ["Côte d’Ivoire", "🇨🇮", "225"],
  ["Croatie", "🇭🇷", "385"], ["Cuba", "🇨🇺", "53"], ["Danemark", "🇩🇰", "45"], ["Djibouti", "🇩🇯", "253"],
  ["Égypte", "🇪🇬", "20"], ["Émirats Arabes Unis", "🇦🇪", "971"], ["Équateur", "🇪🇨", "593"], ["Érythrée", "🇪🇷", "291"],
  ["Estonie", "🇪🇪", "372"], ["Eswatini", "🇸🇿", "268"], ["Éthiopie", "🇪🇹", "251"], ["Fidji", "🇫🇯", "679"],
  ["Finlande", "🇫🇮", "358"], ["Gabon", "🇬🇦", "241"], ["Gambie", "🇬🇲", "220"], ["Géorgie", "🇬🇪", "995"],
  ["Ghana", "🇬🇭", "233"], ["Grèce", "🇬🇷", "30"], ["Guatemala", "🇬🇹", "502"], ["Guinée-Bissau", "🇬🇼", "245"],
  ["Guinée équatoriale", "🇬🇶", "240"], ["Guyana", "🇬🇾", "592"], ["Haïti", "🇭🇹", "509"], ["Honduras", "🇭🇳", "504"],
  ["Hong Kong", "🇭🇰", "852"], ["Hongrie", "🇭🇺", "36"], ["Inde", "🇮🇳", "91"], ["Indonésie", "🇮🇩", "62"],
  ["Irak", "🇮🇶", "964"], ["Iran", "🇮🇷", "98"], ["Irlande", "🇮🇪", "353"], ["Islande", "🇮🇸", "354"],
  ["Israël", "🇮🇱", "972"], ["Jamaïque", "🇯🇲", "1876"], ["Japon", "🇯🇵", "81"], ["Jordanie", "🇯🇴", "962"],
  ["Kazakhstan", "🇰🇿", "7"], ["Kenya", "🇰🇪", "254"], ["Kirghizistan", "🇰🇬", "996"], ["Kiribati", "🇰🇮", "686"],
  ["Kosovo", "🇽🇰", "383"], ["Koweït", "🇰🇼", "965"], ["Laos", "🇱🇦", "856"], ["Lesotho", "🇱🇸", "266"],
  ["Lettonie", "🇱🇻", "371"], ["Liban", "🇱🇧", "961"], ["Liberia", "🇱🇷", "231"], ["Libye", "🇱🇾", "218"],
  ["Liechtenstein", "🇱🇮", "423"], ["Lituanie", "🇱🇹", "370"], ["Luxembourg", "🇱🇺", "352"], ["Macédoine du Nord", "🇲🇰", "389"],
  ["Madagascar", "🇲🇬", "261"], ["Malaisie", "🇲🇾", "60"], ["Malawi", "🇲🇼", "265"], ["Maldives", "🇲🇻", "960"],
  ["Mali", "🇲🇱", "223"], ["Malte", "🇲🇹", "356"], ["Maurice", "🇲🇺", "230"], ["Mauritanie", "🇲🇷", "222"],
  ["Mexique", "🇲🇽", "52"], ["Moldavie", "🇲🇩", "373"], ["Monaco", "🇲🇨", "377"], ["Mongolie", "🇲🇳", "976"],
  ["Monténégro", "🇲🇪", "382"], ["Mozambique", "🇲🇿", "258"], ["Namibie", "🇳🇦", "264"], ["Népal", "🇳🇵", "977"],
  ["Nicaragua", "🇳🇮", "505"], ["Niger", "🇳🇪", "227"], ["Nigeria", "🇳🇬", "234"], ["Norvège", "🇳🇴", "47"],
  ["Nouvelle-Zélande", "🇳🇿", "64"], ["Oman", "🇴🇲", "968"], ["Ouganda", "🇺🇬", "256"], ["Ouzbékistan", "🇺🇿", "998"],
  ["Pakistan", "🇵🇰", "92"], ["Panama", "🇵🇦", "507"], ["Papouasie-Nouvelle-Guinée", "🇵🇬", "675"], ["Paraguay", "🇵🇾", "595"],
  ["Pays-Bas", "🇳🇱", "31"], ["Pérou", "🇵🇪", "51"], ["Philippines", "🇵🇭", "63"], ["Pologne", "🇵🇱", "48"],
  ["Portugal", "🇵🇹", "351"], ["Qatar", "🇶🇦", "974"], ["République Centrafricaine", "🇨🇫", "236"], ["République Dominicaine", "🇩🇴", "1809"],
  ["République Tchèque", "🇨🇿", "420"], ["Roumanie", "🇷🇴", "40"], ["Royaume-Uni", "🇬🇧", "44"], ["Russie", "🇷🇺", "7"],
  ["Rwanda", "🇷🇼", "250"], ["Salvador", "🇸🇻", "503"], ["Samoa", "🇼🇸", "685"], ["Serbie", "🇷🇸", "381"],
  ["Seychelles", "🇸🇨", "248"], ["Sierra Leone", "🇸🇱", "232"], ["Singapour", "🇸🇬", "65"], ["Slovaquie", "🇸🇰", "421"],
  ["Slovénie", "🇸🇮", "386"], ["Somalie", "🇸🇴", "252"], ["Soudan", "🇸🇩", "249"], ["Soudan du Sud", "🇸🇸", "211"],
  ["Sri Lanka", "🇱🇰", "94"], ["Suède", "🇸🇪", "46"], ["Suisse", "🇨🇭", "41"], ["Suriname", "🇸🇷", "597"],
  ["Syrie", "🇸🇾", "963"], ["Tadjikistan", "🇹🇯", "992"], ["Tanzanie", "🇹🇿", "255"], ["Tchad", "🇹🇩", "235"],
  ["Thaïlande", "🇹🇭", "66"], ["Togo", "🇹🇬", "228"], ["Tonga", "🇹🇴", "676"], ["Trinité-et-Tobago", "🇹🇹", "1868"],
  ["Tunisie", "🇹🇳", "216"], ["Turkménistan", "🇹🇲", "993"], ["Turquie", "🇹🇷", "90"], ["Ukraine", "🇺🇦", "380"],
  ["Uruguay", "🇺🇾", "598"], ["Vanuatu", "🇻🇺", "678"], ["Vatican", "🇻🇦", "379"], ["Venezuela", "🇻🇪", "58"],
  ["Vietnam", "🇻🇳", "84"], ["Yémen", "🇾🇪", "967"], ["Zambie", "🇿🇲", "260"], ["Zimbabwe", "🇿🇼", "263"],
].map(([name, flag, dial]) => ({ name, flag, dial })).filter((c, i, arr) => arr.findIndex((x) => x.name === c.name) === i);

/**
 * Champ de téléphone avec sélecteur d’indicatif international (drapeau + code, recherche par nom).
 * `value` est toujours le numéro complet au format international (ex: "+224620000000").
 */
// Longueur attendue du numéro national (hors indicatif) par pays — précise pour nos principales
// destinations, plage large et raisonnable en repli pour les autres pays du monde.
const PHONE_LENGTHS = { "224": [8, 9], "33": [9, 9], "32": [8, 9], "49": [7, 11], "39": [8, 10], "34": [9, 9], "1": [10, 10], "212": [9, 9], "221": [9, 9] };
function isPhoneValid(dial, rest) {
  if (!rest) return null; // champ vide : pas encore d’erreur à afficher
  const [min, max] = PHONE_LENGTHS[dial] || [6, 13];
  return rest.length >= min && rest.length <= max;
}

function PhoneInput({ value, onChange, onBlur, placeholder, defaultDial }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [touched, setTouched] = useState(false);
  const wrapRef = useRef(null);

  function parseValue(v) {
    if (!v) {
      const def = DIAL_CODES.find((c) => c.dial === defaultDial);
      return { dial: def ? def.dial : "224", flag: def ? def.flag : "🇬🇳", rest: "" };
    }
    const match = DIAL_CODES.filter((c) => v.startsWith("+" + c.dial)).sort((a, b) => b.dial.length - a.dial.length)[0];
    return { dial: match ? match.dial : "224", flag: match ? match.flag : "🇬🇳", rest: match ? v.slice(match.dial.length + 1) : v.replace(/^\+/, "") };
  }
  const { dial, flag, rest } = parseValue(value);
  const valid = isPhoneValid(dial, rest);
  const showError = touched && valid === false;

  useEffect(() => {
    function onClickOutside(e) { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function chooseCountry(c) {
    onChange(`+${c.dial}${rest}`);
    setOpen(false); setSearch("");
  }
  function changeRest(newRest) {
    onChange(`+${dial}${newRest.replace(/[^\d]/g, "")}`);
  }

  const filtered = search ? DIAL_CODES.filter((c) => pourRecherche(c.name).includes(pourRecherche(search))) : DIAL_CODES;

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <div style={{ display: "flex", border: `1.5px solid ${showError ? "var(--danger-fg)" : "var(--border)"}`, borderRadius: 8, overflow: "hidden" }}>
        <button type="button" onClick={() => setOpen((o) => !o)} style={{ display: "flex", alignItems: "center", gap: 4, background: "var(--surface2)", border: "none", borderInlineEnd: `1.5px solid ${showError ? "var(--danger-fg)" : "var(--border)"}`, padding: "0 10px", cursor: "pointer", color: "var(--text)", fontSize: 13, flexShrink: 0 }}>
          {flag} +{dial} <ChevronRight size={11} style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s" }} />
        </button>
        <input value={rest} onChange={(e) => changeRest(e.target.value)} onFocus={() => setTouched(true)} onBlur={() => { setTouched(true); onBlur?.(`+${dial}${rest}`); }} placeholder={placeholder || "### ### ###"} style={{ border: "none", outline: "none", flex: 1, fontSize: 13.5, padding: "10px 12px", background: "var(--surface)", color: "var(--text)", minWidth: 0 }} />
        {valid === true && <div style={{ display: "flex", alignItems: "center", paddingInlineEnd: 10 }}><CheckCircle2 size={15} color="#3ECB84" /></div>}
        {showError && <div style={{ display: "flex", alignItems: "center", paddingInlineEnd: 10 }}><AlertTriangle size={15} color="var(--danger-fg)" /></div>}
      </div>
      {showError && (
        <div style={{ fontSize: 11, color: "var(--danger-fg)", marginTop: 4 }}>
          Numéro incorrect pour {flag} +{dial} — {PHONE_LENGTHS[dial] ? `attendu : ${PHONE_LENGTHS[dial][0]}${PHONE_LENGTHS[dial][0] !== PHONE_LENGTHS[dial][1] ? `-${PHONE_LENGTHS[dial][1]}` : ""} chiffres` : "vérifiez le nombre de chiffres"} (saisi : {rest.length}).
        </div>
      )}
      {open && (
        <div style={{ position: "absolute", top: "100%", left: 0, marginTop: 4, width: "min(320px, 90vw)", maxHeight: 280, overflowY: "auto", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "0 12px 32px rgba(0,0,0,0.35)", zIndex: 60 }}>
          <div style={{ padding: 8, position: "sticky", top: 0, background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
            <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un pays..." style={{ width: "100%", border: "1px solid var(--border)", borderRadius: 6, padding: "7px 10px", fontSize: 12.5, background: "var(--surface2)", color: "var(--text)", outline: "none" }} />
          </div>
          {filtered.map((c, i) => (
            <button type="button" key={`${c.name}-${i}`} onClick={() => chooseCountry(c)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", padding: "9px 12px", background: "none", border: "none", cursor: "pointer", textAlign: "start" }}>
              <span style={{ fontSize: 13, color: "var(--text)", display: "flex", alignItems: "center", gap: 8 }}>{c.flag} {c.name}</span>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>+{c.dial}</span>
            </button>
          ))}
          {filtered.length === 0 && <div style={{ padding: 14, fontSize: 12.5, color: "var(--muted)" }}>Aucun pays trouvé.</div>}
        </div>
      )}
    </div>
  );
}

function allowedCountries(session) {
  if (!session || session.role === "Administrateur" || !session.paysAutorises || session.paysAutorises.length === 0) return COUNTRIES;
  return COUNTRIES.filter((c) => c.code === "GN" || session.paysAutorises.includes(c.code));
}
/** Sites d'opération déclarés pour un pays donné (Guinée par défaut si le site n'a pas de pays). */
function sitesPourPays(sites, pays) {
  return (sites || []).filter((s) => (s.pays || "GN") === (pays || "GN"));
}
/** Sites d'opération en Guinée — seuls ceux-ci servent à l'enregistrement, à l'agence de retrait
 *  de l'Espace Client et à l'affectation d'un agent : ce sont des points physiques tenus par nos
 *  agents, contrairement aux sites étrangers qui ne servent que de point de retrait sur le ticket. */
function sitesLocaux(sites) {
  return sitesPourPays(sites, "GN");
}
/**
 * Site où le destinataire vient retirer son colis.
 *
 * Pour un colis livré en Guinée (import, ou export vers "GN"), c'est l'agence de retrait
 * configurée dans Configuration → Agences (Bambeto par défaut). Pour un export vers l'étranger,
 * le retrait se fait chez le destinataire : on renvoie le site déclaré pour ce pays de
 * destination s'il existe, sinon null plutôt que d'annoncer à tort une agence en Guinée.
 */
function siteRetraitPourColis(colis, data) {
  const sites = data?.sites || [];
  const versEtranger = (colis.direction || "export") === "export" && colis.pays && colis.pays !== "GN";
  if (versEtranger) return sites.find((s) => s.pays === colis.pays) || null;
  return sites.find((s) => s.id === (data?.agenceRetraitClient || "site-bambeto")) || sitesLocaux(sites)[0] || sites[0];
}
function routeLabel(pays, direction) {
  const c = COUNTRIES.find((x) => x.code === pays);
  if (!c) return "";
  return direction === "import" ? `${c.city} → Conakry` : `Conakry → ${c.city}`;
}
function loyaltyDiscount(previousCount) {
  if (previousCount >= 11) return 12;
  if (previousCount >= 6) return 8;
  if (previousCount >= 3) return 5;
  return 0;
}
/*
 * Parcours d'un colis, en 5 étapes.
 *
 * « En douane » a été retiré : cette étape n'était jamais renseignée en pratique et allongeait
 * le parcours sans rien apprendre au client. « En livraison » a été renommé « Disponible au
 * retrait » : chez Ba-Diaby Express le colis ne part pas en tournée, c'est le client qui vient
 * le chercher à l'agence. C'est aussi à cette étape que naît le code de retrait.
 */
const STATUSES = ["Enregistré", "En transit", "Arrivé", "Disponible au retrait", "Livré"];
const STATUS_STYLE = {
  "Enregistré": { bg: "var(--surface2)", fg: "var(--neutral-fg)", icon: Package },
  "En transit": { bg: "var(--info-bg)", fg: "var(--info-fg)", icon: Plane },
  "Arrivé": { bg: "var(--warn-bg)", fg: "var(--warn-fg)", icon: MapPin },
  "Disponible au retrait": { bg: "var(--ok-bg-soft)", fg: "var(--ok-fg-alt)", icon: MapPin },
  "Livré": { bg: "var(--ok-bg)", fg: "var(--ok-fg)", icon: CheckCircle2 },
  "Annulé": { bg: "var(--danger-bg)", fg: "var(--danger-fg)", icon: X },
  "Refusé": { bg: "var(--warn-bg)", fg: "var(--warn-fg)", icon: AlertTriangle },
};
const ROLES = ["Administrateur", "Agent", "Comptable", "Chauffeur", "Partenaire"];

/**
 * Langues proposées dans l'interface.
 *
 * La bascule EN/AR fonctionne techniquement (le menu se traduit et l'arabe passe bien en
 * lecture droite-à-gauche), mais seuls les libellés du menu sont traduits : environ 425
 * textes de l'application restent en français. Afficher « EN » ou « AR » livrerait donc une
 * interface mi-anglaise mi-française, ce qui fait moins sérieux qu'un site entièrement en
 * français.
 *
 * Pour réactiver une langue une fois sa traduction terminée, il suffit de l'ajouter ici :
 *   const LANGUES_DISPONIBLES = ["fr", "en"];
 * Le sélecteur se masque automatiquement s'il ne reste qu'une seule langue.
 */
const LANGUES_DISPONIBLES = ["fr"];

/**
 * Nombre d'éléments affichés d'un coup dans les longues listes (colis, paiements).
 * Mesuré : à 3 000 colis, afficher toutes les lignes d'un coup demandait près de 2 secondes à
 * la page Paiements, et le temps grimpe proportionnellement au nombre de colis. On affiche donc
 * une première tranche, avec un bouton pour charger la suite. Le filtrage et la recherche
 * continuent de porter sur la totalité des colis : seul l'affichage est limité.
 */
const TAILLE_PAGE = 100;

/**
 * Traduction des statuts internes en vocabulaire "espace client" uniquement — le statut réel
 * stocké sur le colis (utilisé pour les étiquettes, bordereaux, comptabilité, alertes...) ne
 * change jamais. Seul ce qui s’affiche DANS l’espace client (et sur la page de suivi public)
 * utilise ce vocabulaire plus détaillé.
 *
 * Étapes montrées au client, alignées sur les 5 statuts internes.
 *
 * « Colis annoncé » est une étape virtuelle : elle correspond à une pré-alerte pas encore
 * rapprochée d'un colis réel, donc sans statut associé. Les autres correspondent une à une aux
 * statuts internes — chaque étape affichée reflète une information réellement suivie, plutôt
 * qu'un jalon décoratif.
 */
const CLIENT_TIMELINE = [
  { key: "annonce", label: "Colis annoncé", statuses: [] }, // étape virtuelle : pré-alerte pas encore rapprochée d’un vrai colis
  { key: "entrepot", label: "Reçu à l’entrepôt", statuses: ["Enregistré"] },
  { key: "expedie", label: "Expédié", statuses: ["En transit"] },
  { key: "guinee", label: "Arrivé en Guinée", statuses: ["Arrivé"] },
  { key: "retrait", label: "Disponible pour retrait", statuses: ["Disponible au retrait"] },
  { key: "livre", label: "Livré", statuses: ["Livré"] },
];
function clientStatusLabel(status) {
  const step = CLIENT_TIMELINE.find((s) => s.statuses.includes(status));
  return step ? step.label : status; // "Annulé"/"Refusé" restent affichés tels quels, ce sont des sorties du parcours normal
}
/** Renvoie l’étape (index dans CLIENT_TIMELINE, en sautant l’étape virtuelle "annoncé") atteinte
 * par le statut interne donné, pour dessiner la timeline (étapes franchies vs à venir). */
function clientTimelineIndex(status) {
  const idx = CLIENT_TIMELINE.findIndex((s) => s.statuses.includes(status));
  return idx === -1 ? null : idx;
}

// Sites d’achat en ligne les plus courants pour les clients de Ba-Diaby Express — sert à savoir
// d’où provient un colis (utile pour les pré-alertes et le suivi à la réception).
const VENDEURS_EN_LIGNE = ["Shein", "Amazon", "Jumia", "AliExpress", "Temu", "Alibaba", "Autre"];

// Parcours de validation d’un bordereau : 5 étapes, avec bouton "Statut suivant" fonctionnel.
const BORDEREAU_STATUSES = ["Brouillon", "Acheminement", "Validé", "Arrivé", "Livré"];
const BORDEREAU_STATUS_STYLE = {
  "Brouillon": { bg: "var(--surface2)", fg: "var(--neutral-fg)" },
  "Acheminement": { bg: "var(--info-bg)", fg: "var(--info-fg)" },
  "Validé": { bg: "var(--warn-bg)", fg: "var(--warn-fg)" },
  "Arrivé": { bg: "var(--ok-bg-soft)", fg: "var(--ok-fg-alt)" },
  "Livré": { bg: "var(--ok-bg)", fg: "var(--ok-fg)" },
};
/** Compatibilité avec les anciens bordereaux ("En cours" / "Reçu") créés avant ce nouveau parcours en 5 étapes. */
function normalizeBordereauStatut(statut) {
  if (statut === "En cours") return "Acheminement";
  if (statut === "Reçu") return "Livré";
  return BORDEREAU_STATUSES.includes(statut) ? statut : "Brouillon";
}

const PERMISSIONS_SCHEMA = [
  { group: "COLIS", permissions: [
    { key: "colis.voir_propres", label: "Voir ses propres colis" },
    { key: "colis.voir_tous", label: "Voir tous les colis" },
    { key: "colis.creer", label: "Créer un colis" },
    { key: "colis.modifier", label: "Modifier un colis" },
    { key: "colis.changer_statut", label: "Changer le statut" },
    { key: "colis.annuler", label: "Annuler un colis" },
    { key: "colis.enregistrer_paiement", label: "Enregistrer un paiement" },
    { key: "colis.supprimer", label: "Supprimer un colis" },
    /*
     * Import Excel, bordereau de réception et règlement groupé agissent sur plusieurs colis à la
     * fois (import en masse, encaissement groupé) — des actions plus sensibles que la création
     * d'un colis à l'unité. Non accordées à l'Agent par défaut : c'est à l'administrateur de
     * désigner nommément les agences/agents autorisés, comme pour l'Espace Client.
     */
    { key: "colis.importer_excel", label: "Importer des colis depuis Excel" },
    { key: "colis.bordereau_reception", label: "Générer un bordereau de réception" },
    { key: "colis.reglement_groupe", label: "Encaisser plusieurs colis en une fois (règlement groupé)" },
  ]},
  { group: "BORDEREAUX", permissions: [
    { key: "bordereaux.consulter", label: "Consulter les bordereaux" },
    { key: "bordereaux.creer", label: "Créer un bordereau" },
    { key: "bordereaux.modifier", label: "Modifier un bordereau (ajouter/retirer des colis)" },
    { key: "bordereaux.valider", label: "Marquer un bordereau comme reçu" },
  ]},
  { group: "FACTURES", permissions: [
    { key: "factures.consulter", label: "Consulter les factures" },
    { key: "factures.creer", label: "Générer une facture" },
    { key: "factures.modifier", label: "Encaisser / modifier un paiement" },
  ]},
  { group: "CLIENTS", permissions: [
    { key: "clients.consulter", label: "Consulter les clients" },
  ]},
  /*
   * L'Espace Client est un circuit à part : commandes annoncées, réception et pesée, messages,
   * demandes express. Tous les agents n'ont pas vocation à y toucher — et un partenaire ne doit
   * jamais y accéder. Cette permission n'est accordée à personne par défaut hors administrateur :
   * c'est à l'administrateur de désigner nommément les agents concernés.
   */
  { group: "ESPACE CLIENT", permissions: [
    { key: "espaceclient.gerer", label: "Traiter les demandes de l’Espace Client (réception, messages, express)" },
  ]},
  { group: "COMPTABILITÉ", permissions: [
    { key: "compta.consulter", label: "Consulter la comptabilité" },
    { key: "compta.gerer_depenses", label: "Ajouter / modifier / supprimer une dépense" },
    { key: "compta.charges_fixes", label: "Gérer les charges fixes (salaires, loyers...)" },
    { key: "compta.marges", label: "Consulter les marges et bénéfices" },
  ]},
  { group: "STATISTIQUES", permissions: [
    { key: "stats.globales", label: "Voir les statistiques globales (toutes agences)" },
    { key: "stats.personnelles", label: "Voir ses propres statistiques" },
    { key: "stats.exporter", label: "Exporter les données (CSV / sauvegarde)" },
  ]},
  { group: "CONFIGURATION", permissions: [
    { key: "config.acceder", label: "Accéder à la configuration" },
    { key: "config.tarifs", label: "Modifier les tarifs, devises et commissions" },
    { key: "config.categories", label: "Gérer les catégories de produits" },
  ]},
  { group: "UTILISATEURS", permissions: [
    { key: "users.consulter", label: "Consulter les utilisateurs" },
    { key: "users.gerer", label: "Créer / modifier / supprimer un utilisateur" },
    { key: "users.permissions", label: "Gérer les permissions des autres comptes" },
  ]},
  { group: "ASSISTANT IA", permissions: [
    { key: "ia.utiliser", label: "Utiliser l’assistant IA" },
  ]},
];

const ROLE_DEFAULT_PERMISSIONS = {
  "Administrateur": PERMISSIONS_SCHEMA.flatMap((g) => g.permissions.map((p) => p.key)),
  "Agent": ["colis.voir_propres", "colis.voir_tous", "colis.creer", "colis.modifier", "colis.changer_statut", "colis.enregistrer_paiement", "bordereaux.consulter", "bordereaux.creer", "bordereaux.modifier", "bordereaux.valider", "factures.consulter", "factures.creer", "factures.modifier", "paiements.voir_propres", "clients.consulter", "stats.personnelles", "ia.utiliser"],
  "Comptable": ["colis.voir_tous", "factures.consulter", "factures.creer", "factures.modifier", "clients.consulter", "bordereaux.consulter", "compta.consulter", "compta.gerer_depenses", "compta.charges_fixes", "compta.marges", "stats.globales", "stats.exporter"],
  "Chauffeur": ["colis.voir_propres", "colis.changer_statut", "stats.personnelles"],
  "Partenaire": ["stats.personnelles"],
};

function effectivePermission(user, key) {
  if (!user) return false;
  if (user.permissionsOverride && Object.prototype.hasOwnProperty.call(user.permissionsOverride, key)) return user.permissionsOverride[key];
  return (ROLE_DEFAULT_PERMISSIONS[user.role] || []).includes(key);
}

const T = {
  fr: { dashboard: "Tableau de bord", colis: "Colis", tarif: "Tarification", clients: "Clients", admin: "Configuration", ia: "Assistant IA", logout: "Déconnexion", newColis: "Nouveau colis", search: "Rechercher", createAccount: "Créer un compte", bordereaux: "Bordereaux", paiements: "Paiements & Factures" },
  en: { dashboard: "Dashboard", colis: "Parcels", tarif: "Pricing", clients: "Clients", admin: "Settings", ia: "AI Assistant", logout: "Log out", newColis: "New parcel", search: "Search", createAccount: "Create account", bordereaux: "Waybills", paiements: "Payments & Invoices" },
  ar: { dashboard: "لوحة القيادة", colis: "الطرود", tarif: "التسعير", clients: "العملاء", admin: "الإعدادات", ia: "مساعد الذكاء الاصطناعي", logout: "تسجيل الخروج", newColis: "طرد جديد", search: "بحث", createAccount: "إنشاء حساب", bordereaux: "بيانات الشحن", paiements: "المدفوعات والفواتير" },
};

function hash(str) {
  // Ancienne méthode — CONSERVÉE UNIQUEMENT pour reconnaître les comptes créés avant la mise à jour
  // sécurité. Ce n’est PAS un hachage cryptographique fiable ; les nouveaux comptes et les comptes
  // existants sont automatiquement migrés vers hashSecure() dès leur première connexion réussie.
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  return "h" + h.toString(16);
}
/** Génère un sel aléatoire cryptographiquement sûr (hex). */
function genSalt() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}
/** Hachage de mot de passe sécurisé : SHA-256 salé, via l’API Web Crypto native du navigateur. */
async function hashSecure(password, salt) {
  const data = new TextEncoder().encode(salt + ":" + password);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Nombre d'itérations PBKDF2. SHA-256 en un seul passage est conçu pour être RAPIDE : si la base
 * fuitait, un attaquant testerait des milliards de mots de passe par seconde. PBKDF2 rend chaque
 * essai volontairement lent (ici ~150 000 tours), ce qui rend une attaque par force brute
 * pratiquement impossible tout en restant imperceptible à la connexion (quelques dizaines de ms).
 */
const PBKDF2_ITERATIONS = 150000;

async function hashPBKDF2(password, salt, iterations = PBKDF2_ITERATIONS) {
  const enc = new TextEncoder();
  const cle = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: enc.encode(salt), iterations, hash: "SHA-256" }, cle, 256);
  return Array.from(new Uint8Array(bits)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Fabrique les champs à enregistrer pour un mot de passe. Utilisée par TOUS les points de création
 * ou de changement de mot de passe, afin qu'aucun ne puisse rester sur un schéma plus faible.
 */
async function creerIdentifiantsMotDePasse(password) {
  const salt = genSalt();
  return {
    motdepasseAlgo: "pbkdf2",
    motdepasseIter: PBKDF2_ITERATIONS,
    motdepasseSalt: salt,
    motdepasseSecure: await hashPBKDF2(password, salt),
    motdepasse: undefined,
  };
}

/**
 * Vérifie un mot de passe, quel que soit le schéma avec lequel il a été enregistré :
 *   1. PBKDF2 salé (schéma actuel)
 *   2. SHA-256 salé (schéma intermédiaire) — migré vers PBKDF2 à la première connexion réussie
 *   3. très ancien hachage, ou mot de passe resté en clair — également migré
 * Retourne { ok, migratedUser } ; migratedUser doit être enregistré s'il n'est pas nul.
 */
async function verifyPassword(password, user) {
  if (user.motdepasseAlgo === "pbkdf2" && user.motdepasseSalt && user.motdepasseSecure) {
    const calcule = await hashPBKDF2(password, user.motdepasseSalt, user.motdepasseIter || PBKDF2_ITERATIONS);
    return { ok: calcule === user.motdepasseSecure, migratedUser: null };
  }
  if (user.motdepasseSalt && user.motdepasseSecure) {
    const calcule = await hashSecure(password, user.motdepasseSalt);
    if (calcule !== user.motdepasseSecure) return { ok: false, migratedUser: null };
    return { ok: true, migratedUser: { ...user, ...(await creerIdentifiantsMotDePasse(password)) } };
  }
  const legacyOk = user.motdepasse === hash(password) || user.motdepasse === password;
  if (!legacyOk) return { ok: false, migratedUser: null };
  return { ok: true, migratedUser: { ...user, ...(await creerIdentifiantsMotDePasse(password)) } };
}
/**
 * Numéro de suivi : BDE + jour + mois + ordre d'arrivée dans la journée.
 *
 * Exemple : le 3e colis déposé le 15 août donne BDE150803.
 * L'agent lit immédiatement la date de dépôt sans ouvrir la fiche, et le rang indique combien de
 * colis sont passés ce jour-là.
 *
 * Deux chiffres d'ordre suffisent jusqu'à 99 colis par jour. Au-delà, plutôt que de refuser
 * l'enregistrement ou de créer un doublon, on passe à trois chiffres (BDE1508100). Le numéro reste
 * lisible et le dépôt n'est jamais bloqué — ce serait le pire moment pour perdre un colis.
 */
/**
 * Salutation adaptée à l'heure locale de la personne connectée.
 *
 * L'heure vient de l'appareil, pas du serveur : un client à Paris et un agent à Conakry voient
 * chacun la salutation qui correspond à SON moment de la journée.
 *
 *   05h–11h59 : Bonjour        12h–17h59 : Bon après-midi        18h–04h59 : Bonsoir
 *
 * La nuit est rattachée au soir : à 2 h du matin, « Bonsoir » est plus naturel que « Bonjour ».
 */
function salutationSelonHeure() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Bonjour";
  if (h >= 12 && h < 18) return "Bon après-midi";
  return "Bonsoir";
}

/**
 * Départs encore ouverts au dépôt, triés du plus proche au plus lointain.
 * Un départ dont la date limite est passée disparaît automatiquement : inutile d'annoncer
 * une échéance que le client ne peut plus tenir.
 */
function departsAVenir(departs, pays = null) {
  const maintenant = Date.now();
  return (departs || [])
    .filter((d) => d.dateLimite && new Date(d.dateLimite).getTime() >= maintenant)
    .filter((d) => !pays || d.pays === pays)
    .sort((a, b) => new Date(a.dateDepart) - new Date(b.dateDepart));
}

function genTracking(existingTrackings, dateDepot) {
  const taken = new Set(existingTrackings || []);
  const d = dateDepot ? new Date(dateDepot) : new Date();
  const jour = String(d.getDate()).padStart(2, "0");
  const mois = String(d.getMonth() + 1).padStart(2, "0");
  const prefixe = `BDE${jour}${mois}`;

  for (let ordre = 1; ordre <= 99; ordre++) {
    const code = `${prefixe}${String(ordre).padStart(2, "0")}`;
    if (!taken.has(code)) return code;
  }
  // Journée exceptionnelle : on élargit à trois chiffres.
  for (let ordre = 100; ordre <= 999; ordre++) {
    const code = `${prefixe}${ordre}`;
    if (!taken.has(code)) return code;
  }
  // Dernier recours, pour ne jamais empêcher un enregistrement.
  return `${prefixe}${Date.now().toString().slice(-4)}`;
}
function genOtp() { return String(Math.floor(100000 + Math.random() * 900000)); }

/**
 * Code de retrait à 4 chiffres, envoyé au client dès que son colis devient disponible.
 * Quatre chiffres suffisent : le code ne vaut que pour un colis précis, et l'agent le contrôle
 * en face du client. Plus long, il serait pénible à dicter au comptoir.
 */
function genCodeRetrait() { return String(Math.floor(1000 + Math.random() * 9000)); }
let LIVE_RATES = { ...CURRENCIES };
function fmt(n, cur) {
  const v = n * (LIVE_RATES[cur] || CURRENCIES[cur] || 1);
  const decimals = cur === "GNF" || cur === "XOF" ? 0 : 2;
  return `${v.toLocaleString("fr-FR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} ${cur}`;
}
/** Comme fmt(), mais renvoie juste le nombre converti (sans suffixe de devise) — utile pour préremplir un champ modifiable. */
function fmtRaw(n, cur) {
  const v = n * (LIVE_RATES[cur] || CURRENCIES[cur] || 1);
  const decimals = cur === "GNF" || cur === "XOF" ? 0 : 2;
  return +v.toFixed(decimals);
}
/** Formate un montant déjà exprimé en GNF (ex: prix de catégorie, valeur déclarée saisie directement) sans reconversion. */
function fmtGNF(n) {
  return `${Math.round(n || 0).toLocaleString("fr-FR")} GNF`;
}
/** Calcule en direct l’équivalent GNF d’une catégorie à partir du taux de change actuel — se met à jour automatiquement si le taux change. */
function catPriceGNF(cat) {
  if (!cat) return 0;
  const montant = Number(cat.montant ?? cat.prixGNF ?? 0);
  const devise = cat.deviseSaisie || "GNF";
  if (devise === "GNF") return montant;
  const eurBase = montant / (LIVE_RATES[devise] || CURRENCIES[devise] || 1);
  return Math.round(eurBase * (LIVE_RATES.GNF || CURRENCIES.GNF));
}
/** Calcule la commission d’agence gagnée sur un colis, en EUR, selon les taux (globaux ou par catégorie). */
function calcCommission(colis, commissionConfig, categories) {
  const cfg = commissionConfig || { parKg: 2, parUnite: 5 };
  if (!colis.produits || colis.produits.length === 0) {
    return (Number(colis.poids) || 0) * cfg.parKg;
  }
  return colis.produits.reduce((total, p) => {
    const cat = (categories || []).find((c) => c.nom === p.categorie);
    const isKg = cat ? cat.type === "kg" : true;
    const rate = cat && cat.commissionRate != null ? cat.commissionRate : (isKg ? cfg.parKg : cfg.parUnite);
    const base = isKg ? (Number(p.poids) || 0) : (Number(p.quantite) || 1);
    return total + rate * base;
  }, 0);
}
/**
 * Frais de réception/récupération à l’agence, calculés sur le poids TOTAL des colis
 * sélectionnés pour un même bordereau de réception client. Tarif par paliers (ex : 1-10 kg,
 * 11-40 kg, 41-100 kg) : le palier atteint par le poids total du lot s’applique à tout le lot.
 */
function calcReceptionFee(poidsTotal, tarifs) {
  const paliers = tarifs?.paliers || [{ max: 10, tarif: 100000 }, { max: 40, tarif: 95000 }, { max: 100, tarif: 92000 }];
  const sorted = [...paliers].sort((a, b) => a.max - b.max);
  const palier = sorted.find((p) => poidsTotal <= p.max) || sorted[sorted.length - 1];
  const tauxParKg = palier.tarif;
  return { tauxParKg, total: Math.round(poidsTotal * tauxParKg), palier };
}
/** Ajoute une entrée au journal d’activité global (les 500 dernières actions sont conservées). */
function pushActivity(data, session, action, detail) {
  const entry = { id: `log${Date.now()}${Math.random().toString(36).slice(2,5)}`, action, detail, date: new Date().toISOString(), utilisateur: `${session.prenom} ${session.nom}`, role: session.role };
  return [entry, ...(data.activityLog || [])].slice(0, 500);
}
/**
 * Redimensionne et compresse une photo avant de la stocker.
 *
 * Les photos sont conservées en base64 dans les données du colis, et l'application réécrit
 * l'ensemble des données à chaque modification. Une photo trop lourde ne pèse donc pas une
 * fois : elle est retransmise à chaque création de colis, chaque encaissement, chaque
 * changement de statut. Sur une connexion mobile, c'est ce qui rend une application lente.
 *
 * 720 px et une qualité de 0,6 suffisent largement à constater l'état d'un colis à l'arrivée
 * — l'usage réel de ces photos. Cela divise leur poids par deux environ.
 */
function resizeImageToDataUrl(file, maxWidth = 720, quality = 0.6) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
function waLink(phone, msg) { return `https://wa.me/${(phone || "").replace(/[^\d]/g, "")}?text=${encodeURIComponent(msg)}`; }

/**
 * Envoie un message WhatsApp au client.
 *
 * Tente d'abord l'envoi automatique via Twilio (fonction serveur /api/whatsapp, où vivent les
 * identifiants). Si Twilio n'est pas configuré, ou si l'envoi échoue, on retombe sur le
 * comportement actuel : ouverture d'un brouillon WhatsApp que l'agent envoie lui-même.
 * Ainsi rien ne casse tant que Twilio n'est pas prêt, et l'agent n'est jamais bloqué.
 *
 * Retourne { envoye, raison } — `raison` est un message lisible à afficher à l'agent.
 */
/**
 * Catalogue des événements pouvant déclencher une notification WhatsApp.
 * Sert à la fois à construire l'écran de réglages et à retrouver le libellé d'un événement.
 */
const EVENEMENTS_WHATSAPP = [
  { cle: "enregistrement", label: "À l’enregistrement du colis" },
  { cle: "expedie",        label: "Quand le colis est expédié" },
  { cle: "arrivee",        label: "À l’arrivée en Guinée" },
  { cle: "retrait",        label: "Quand le colis est disponible au retrait" },
  { cle: "livre",          label: "Quand le colis est remis au client" },
  { cle: "paiement",       label: "À la réception d’un paiement" },
  { cle: "modification",   label: "Après modification du colis" },
  { cle: "relanceRetrait", label: "Rappel d’un colis non retiré" },
];

/**
 * Envoie une notification pour un événement donné, en respectant les préférences de l'agence.
 *
 * Rien n'est envoyé si l'événement est désactivé, ou si le numéro concerné est absent. Les envois
 * sont silencieux : ils ne doivent jamais interrompre le travail de l'agent ni faire échouer
 * l'action principale (créer un colis, encaisser…). Si WhatsApp est indisponible, le colis est
 * quand même enregistré.
 */
async function notifierEvenement(data, evenement, colis, message) {
  const prefs = (data?.notifWhatsApp || {})[evenement];
  if (!prefs) return { envoyes: 0 };
  let envoyes = 0;

  const destinations = [];
  if (prefs.destinataire && colis.telephone) destinations.push(colis.telephone);
  if (prefs.expediteur && colis.expediteurTelephone) destinations.push(colis.expediteurTelephone);
  for (const tel of destinations) {
    try {
      const { envoye } = await envoyerWhatsApp(tel, message);
      if (envoye) envoyes++;
    } catch (e) { /* une notification ne doit jamais bloquer l'action en cours */ }
  }

  /*
   * Le même message part aussi par e-mail, quand une adresse est renseignée.
   *
   * Un client qui a donné son adresse suit ainsi son colis de l'enregistrement à la livraison,
   * sans dépendre de WhatsApp — utile pour vos clients en France, en Belgique ou aux États-Unis,
   * qui n'ont pas toujours WhatsApp mais consultent leur messagerie.
   *
   * Les préférences sont les mêmes que pour WhatsApp : désactiver une étape la désactive sur
   * les deux canaux. Un seul réglage à comprendre pour vos agents.
   */
  const adresses = [];
  if (prefs.destinataire && (colis.destinataireEmail || colis.email)) adresses.push(colis.destinataireEmail || colis.email);
  if (prefs.expediteur && colis.expediteurEmail) adresses.push(colis.expediteurEmail);
  for (const adresse of adresses) {
    try {
      await envoyerEmail(
        adresse,
        `Ba-Diaby Express — colis ${colis.tracking}`,
        `<p>${message}</p>
         <p style="color:#888;font-size:12px;margin-top:18px">
           Ba-Diaby Express — Transport de colis Conakry - Monde<br>
           Suivez votre colis à tout moment avec le numéro ${colis.tracking}.
         </p>`
      );
    } catch (e) { /* idem : l'action principale prime sur la notification */ }
  }

  return { envoyes };
}

/**
 * Envoie un e-mail au client, avec ses documents en pièce jointe.
 *
 * Tente l'envoi automatique via la fonction serveur ; si le service n'est pas configuré ou si
 * l'envoi échoue, retourne un échec silencieux plutôt que d'interrompre le travail de l'agent.
 * L'appelant décide alors quoi faire — généralement ouvrir un brouillon.
 *
 * Retourne { envoye, raison } — `raison` est un message lisible, ou null si le service est
 * simplement absent (cas normal tant qu'aucune clé n'est configurée).
 */
async function envoyerEmail(adresse, sujet, message, piecesJointes = []) {
  if (!adresse) return { envoye: false, raison: null };
  try {
    const reponse = await fetch("/api/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: adresse, sujet, message, piecesJointes }),
    });
    if (reponse.ok) return { envoye: true };
    if (reponse.status === 501) return { envoye: false, raison: null };
    const data = await reponse.json().catch(() => ({}));
    return { envoye: false, raison: data.error || "L’envoi de l’e-mail a échoué." };
  } catch (e) {
    return { envoye: false, raison: null };
  }
}

async function envoyerWhatsApp(telephone, message) {
  try {
    const reponse = await fetch("/api/whatsapp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: telephone, message }),
    });
    if (reponse.ok) return { envoye: true };
    const data = await reponse.json().catch(() => ({}));
    // 501 = Twilio pas encore configuré : cas normal, on ne parle pas d'erreur à l'agent.
    if (reponse.status === 501) return { envoye: false, raison: null };
    return { envoye: false, raison: data.error || "L’envoi automatique a échoué." };
  } catch (e) {
    return { envoye: false, raison: null };   // hors ligne ou fonction absente
  }
}
/** Le QR imprimé sur l’étiquette pointe vers l’URL de suivi public (?suivi=1&code=XXX) — on
 * en extrait le numéro de suivi ; si le scan renvoie directement un numéro, on le garde tel quel. */
function extractTrackingFromScan(raw) {
  try {
    const url = new URL(raw);
    const code = url.searchParams.get("code");
    if (code) return code;
  } catch { /* pas une URL — on suppose que c’est directement le numéro */ }
  return raw.trim();
}

/** URL publique de suivi d’un colis — utilisée dans TOUS les QR codes imprimés (étiquette,
 * facture, ticket) pour qu’un client qui scanne avec l’appareil photo de son téléphone
 * arrive directement sur sa page de suivi, au lieu de lire un numéro brut inutilisable.
 * Le scanner interne accepte les deux formes (voir extractTrackingFromScan). */
function trackingUrlFor(tracking) {
  const base = typeof window !== "undefined" && window.location?.origin && !window.location.origin.startsWith("file")
    ? window.location.origin
    : "https://ba-diaby-express.vercel.app";
  return `${base}/?suivi=1&code=${tracking}`;
}

function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = src; s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}
/**
 * Nettoie un texte destiné à un PDF.
 *
 * Les polices intégrées de jsPDF utilisent l'encodage WinAnsi, qui ne contient qu'un jeu de
 * caractères limité. Tout caractère absent s'imprime sous forme de glyphe parasite. Deux cas
 * passaient inaperçus à l'écran mais cassaient les documents imprimés :
 *
 *   - l'espace fine insécable (U+202F) que le format français insère dans les nombres :
 *     « 64 980 GNF » s'imprimait « 64/980 GNF ». Cela touchait TOUS les montants à quatre
 *     chiffres ou plus, dans tous les documents ;
 *   - les flèches (→, ⇄) des libellés de route : « Conakry → Paris » devenait « Conakry !' Paris ».
 *
 * Ces caractères restent utilisés à l'écran, où ils s'affichent parfaitement ; seule la version
 * imprimée est convertie.
 */
function nettoyerTextePdf(valeur) {
  return String(valeur ?? "")
    .replace(/[\u202F\u2009\u200A\u00A0]/g, " ")  // espaces fines / insécables -> espace normal
    .replace(/[\u2192\u2794\u279C\u27A1]/g, "-")   // flèches vers la droite
    .replace(/[\u2190\u21C4\u2194]/g, "-")          // autres flèches
    .replace(/\u2248/g, "~")                         // presque égal
    .replace(/\u2713/g, "OK")                        // coche
    .replace(/\u2717/g, "X");                        // croix
}

/**
 * Enveloppe un document jsPDF pour que TOUT texte imprimé passe par nettoyerTextePdf().
 * Appelée juste après la création de chaque document : ainsi aucun futur appel à doc.text()
 * ne peut réintroduire le problème, y compris dans du code ajouté plus tard.
 */
function preparerDocPdf(doc) {
  const originale = doc.text.bind(doc);
  doc.text = function (texte, ...reste) {
    const propre = Array.isArray(texte) ? texte.map(nettoyerTextePdf) : nettoyerTextePdf(texte);
    return originale(propre, ...reste);
  };
  return doc;
}

async function loadJsPDF() {
  if (!window.jspdf) await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
  return window.jspdf;
}
/** Charge SheetJS (lecture/écriture de fichiers Excel côté navigateur) depuis le CDN, à la demande. */
async function loadXLSXLib() {
  if (!window.XLSX) await loadScript("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js");
  return window.XLSX;
}
/**
 * Ouvre le PDF dans un nouvel onglet plutôt que de forcer un téléchargement direct :
 * les téléchargements déclenchés par JS sont souvent bloqués silencieusement dans les
 * environnements en iframe (aucune erreur visible), alors que l’ouverture d’un onglet
 * est généralement autorisée. L’utilisateur peut ensuite l’enregistrer depuis le navigateur.
 */
function openPdf(doc, filename) {
  try {
    const blobUrl = doc.output("bloburl");
    const w = window.open(blobUrl, "_blank");
    if (!w) throw new Error("popup bloqué");
  } catch (e) {
    console.error("Ouverture en onglet impossible, tentative de téléchargement direct.", e);
    doc.save(filename);
  }
}
async function ensureAutoTable() {
  if (window.jspdf?.jsPDF?.API?.autoTable) return true;
  try {
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js");
    return true;
  } catch (e) {
    console.error("autoTable indisponible, tableau manuel utilisé à la place.", e);
    return false;
  }
}
async function ensureQRCodeLib() {
  if (window.QRCode && window.QRCode.toDataURL) return true;
  try { await loadScript("https://cdnjs.cloudflare.com/ajax/libs/qrcode/1.4.4/qrcode.min.js"); return !!(window.QRCode && window.QRCode.toDataURL); }
  catch (e) { console.error("Librairie QR indisponible.", e); return false; }
}
/** Charge jsQR (lecture de QR codes depuis une image/vidéo), utilisé en repli quand l’API
 * native BarcodeDetector n’est pas disponible sur le navigateur. */
async function ensureJsQR() {
  if (window.jsQR) return true;
  try { await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jsqr/1.4.0/jsQR.js"); return !!window.jsQR; }
  catch (e) { console.error("Librairie jsQR indisponible.", e); return false; }
}
/** Charge JsBarcode (génération de vrais codes-barres Code128) depuis le CDN, à la demande. */
async function ensureBarcodeLib() {
  if (window.JsBarcode) return true;
  try { await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jsbarcode/3.11.3/JsBarcode.all.min.js"); return true; }
  catch (e) { console.error("Librairie code-barres indisponible.", e); return false; }
}
/** Génère un vrai code-barres Code128 en image PNG, entièrement côté navigateur. */
async function generateBarcodeDataUrl(text) {
  const ok = await ensureBarcodeLib();
  if (!ok) throw new Error("Librairie code-barres non chargée");
  const canvas = document.createElement("canvas");
  window.JsBarcode(canvas, text, { format: "CODE128", displayValue: false, margin: 0, height: 60, width: 2.2, background: "#ffffff", lineColor: "#0A0A0A" });
  return canvas.toDataURL("image/png");
}
/** Génère un QR code entièrement côté navigateur (aucun appel réseau vers un service tiers). */
async function generateQRDataUrl(text, size = 200) {
  const ok = await ensureQRCodeLib();
  if (!ok) throw new Error("Librairie QR non chargée");
  return new Promise((resolve, reject) => {
    window.QRCode.toDataURL(text, { width: size, margin: 1, errorCorrectionLevel: "M" }, (err, url) => {
      if (err || !url) reject(err || new Error("QR non généré"));
      else resolve(url);
    });
  });
}

function defaultSeed() {
  const emojis = { "Vêtements": "👕", "Électronique": "📱", "Documents": "📄", "Alimentaire": "🍎", "Cosmétiques": "💄", "Autre": "📦" };
  return {
    /*
     * Compte administrateur.
     *
     * Le compte de démonstration « admin / admin123 » a été supprimé : c'était une porte d'entrée
     * connue de tous. Le mot de passe n'est jamais stocké en clair — seule son empreinte PBKDF2
     * (150 000 itérations, sel unique) est enregistrée, et elle ne permet pas de le retrouver.
     */
    users: [DONNEES_REFERENCE.admin],
    colis: [], lang: "fr", theme: "dark",
    branding: { logo: DEFAULT_LOGO },
    clientAccounts: [],
    preAlertes: [],
    // Agence où les clients de l'Espace Client viennent retirer leurs colis. Affichée dans leur
    // espace dès que le colis est disponible. Modifiable par l'administrateur.
    /*
     * Notifications WhatsApp automatiques.
     *
     * Chaque événement peut prévenir l'expéditeur, le destinataire, ou les deux. Les valeurs par
     * défaut suivent le bon sens : le destinataire est informé de tout ce qui le concerne, tandis
     * que l'expéditeur n'est prévenu que des étapes qui l'intéressent vraiment (enregistrement,
     * remise, paiement) — pour ne pas le noyer sous les messages.
     */
    notifWhatsApp: {
      enregistrement:  { expediteur: true,  destinataire: true },
      expedie:         { expediteur: false, destinataire: true },
      arrivee:         { expediteur: false, destinataire: true },
      retrait:         { expediteur: false, destinataire: true },
      livre:           { expediteur: true,  destinataire: true },
      paiement:        { expediteur: true,  destinataire: true },
      modification:    { expediteur: false, destinataire: false },
      relanceRetrait:  { expediteur: false, destinataire: true },
    },
    /*
     * Remise sur le volume : un gros colis coûte proportionnellement moins cher à traiter (une
     * seule étiquette, un seul passage en douane, une seule remise au client). Elle s'applique
     * sur le poids TOTAL et se cumule avec la remise fidélité, qui récompense le nombre d'envois.
     * Désactivée par défaut : à activer dans Configuration → Tarifs de réception.
     */
    remiseVolume: {
      active: false,
      paliers: [
        { minKg: 20, remise: 5 },
        { minKg: 50, remise: 10 },
        { minKg: 100, remise: 15 },
      ],
    },
    /*
     * Calendrier des départs.
     *
     * « Quand part le prochain envoi pour Paris ? » est la question la plus posée aux agents.
     * Y répondre au téléphone toute la journée coûte du temps ; l'afficher dans l'Espace Client
     * et sur la page de suivi répond à leur place.
     *
     * Chaque départ porte une date limite de dépôt : c'est elle qui compte pour le client, pas
     * la date de départ elle-même. Un départ dont la limite est passée n'est plus proposé.
     */
    departs: [],
    agenceRetraitClient: "site-bambeto",
    receptionTarifs: { paliers: [{ max: 10, tarif: 100000 }, { max: 40, tarif: 95000 }, { max: 100, tarif: 92000 }] },
    expressTarifEurKg: 12,
    exchangeRates: { ...CURRENCIES },
    /*
     * Catégories reprises de l'ancienne plateforme d'Ibrahima, avec leurs tarifs et mots-clés.
     * Les prix en EUR sont convertis au taux du jour à l'affichage ; ceux saisis directement en
     * GNF (Bateau, Shein/Temu, Vêtement USA, Petit Sipas) restent fixes.
     * `parDefaut` désigne la catégorie appliquée quand aucune ne correspond.
     */
    categories: DONNEES_REFERENCE.categories.map((c, i) => ({
      id: `cat-${i}`, visibiliteColis: true, visibiliteFactures: true, ordre: i,
      parDefaut: false, commissionRate: null, ...c,
    })),
    sites: [
      { id: "site-bambeto", nom: "Bambeto", adresse: "Bambeto, Conakry", telephone: "+224612479339", horaires: "Lun–Sam 8h–18h", paiements: "Espèces, Orange Money", stockage: "Retrait sous 7 jours" },
      { id: "site-madina", nom: "Madina", adresse: "Madina, Conakry", telephone: "+224612479339", horaires: "Lun–Sam 8h–18h", paiements: "Espèces, Orange Money", stockage: "Retrait sous 7 jours" },
    ],
    agencesReception: {
      FR: { adresse: "26 rue Saint Blaise, 75020 Paris", telephone: "+33767562963", horaires: "" },
    },
    entreprise: { adresseSiege: "Bambeto, Conakry, Guinée", telephone: "+224612479339", email: "badiabyexpress.bde@gmail.com", siteWeb: "www.ba-diaby-express.com" },
    commissionConfig: { parKg: 2, parUnite: 5 }, // EUR — modifiable par l’Administrateur uniquement
  };
}
async function loadData() {
  try {
    const r = await storage.get("bde-data", true);
    return JSON.parse(r.value);
  } catch (e) {
    const seed = defaultSeed();
    try { await storage.set("bde-data", JSON.stringify(seed), true); }
    catch (e2) { console.error("Stockage indisponible, poursuite en mode local sans sauvegarde.", e2); }
    return seed;
  }
}
/**
 * Enregistre les données.
 *
 * Retourne `{ queued: true }` si l'écriture n'a pas pu aboutir et attend dans la file : c'est
 * cette information qui permet à l'appelant de prévenir l'agent. Avaler l'erreur ici laisserait
 * croire qu'un encaissement est enregistré alors qu'il ne l'est pas encore.
 */
async function saveData(data) {
  return storage.set("bde-data", JSON.stringify(data), true);
}
// Mode hors-ligne : dans l’artefact Claude, le stockage est toujours fiable, donc ces fonctions
// ne font rien de particulier ici. Sur le site déployé (Supabase), src/lib/storage.js fournit de
// vraies versions qui mettent les écritures en file d’attente hors-ligne et les rejouent au retour
// de la connexion — remplacées automatiquement au déploiement (voir apply_deploy_patches.py).

const BACKUP_PREFIX = "bde-backup-";
const BACKUP_RETENTION_DAYS = 14;
/**
 * Sauvegarde automatique quotidienne : si aucune sauvegarde n’a encore été faite aujourd’hui,
 * enregistre une copie complète des données sous une clé horodatée, et purge les sauvegardes
 * de plus de 14 jours. Ne bloque jamais le chargement de l’app en cas d’échec.
 */
async function autoBackupIfNeeded(data) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const key = `${BACKUP_PREFIX}${today}`;
    try { await storage.get(key, true); return; } catch (e) { /* pas encore de sauvegarde aujourd’hui, on continue */ }
    await storage.set(key, JSON.stringify(data), true);
    const list = await storage.list(BACKUP_PREFIX, true);
    const dates = (list.keys || []).filter((k) => k.startsWith(BACKUP_PREFIX)).sort();
    const tooOld = dates.slice(0, Math.max(0, dates.length - BACKUP_RETENTION_DAYS));
    for (const oldKey of tooOld) { try { await storage.delete(oldKey, true); } catch (e2) { /* pas grave, sera réessayé plus tard */ } }
  } catch (e) {
    console.error("Sauvegarde automatique impossible aujourd’hui — nouvelle tentative au prochain chargement.", e);
  }
}
async function listBackups() {
  try {
    const list = await storage.list(BACKUP_PREFIX, true);
    return (list.keys || []).filter((k) => k.startsWith(BACKUP_PREFIX)).sort().reverse();
  } catch (e) { return []; }
}
async function loadBackup(key) {
  const r = await storage.get(key, true);
  return JSON.parse(r.value);
}

/** QR code affiché à l’écran, généré localement, avec repli visuel en cas d’échec. */
const QRCodeImg = memo(function QRCodeImg({ value, size = 70 }) {
  const [src, setSrc] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    generateQRDataUrl(value, size * 3).then((url) => { if (!cancelled) setSrc(url); }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [value, size]);
  if (failed) return <div style={{ width: size, height: size, background: "var(--surface2)", borderRadius: 6, display: "grid", placeItems: "center", fontSize: 9, color: "var(--muted)", textAlign: "center" }}>QR indisponible</div>;
  if (!src) return <div style={{ width: size, height: size, background: "var(--surface2)", borderRadius: 6 }} />;
  return <img src={src} alt="QR" width={size} height={size} style={{ background: "#fff", borderRadius: 6, padding: 4 }} />;
});

function Barcode({ value }) {
  return (
    <div style={{ height: 40, background: "var(--surface)", padding: "4px 8px", borderRadius: 6, display: "flex", alignItems: "center", gap: 1 }}>
      {value.split("").map((ch, i) => (
        <div key={i} style={{ width: (ch.charCodeAt(0) % 3) + 1, height: 28 + (ch.charCodeAt(0) % 8), background: "#0A2647" }} />
      ))}
    </div>
  );
}

/** Détecte si l’écran est de taille mobile, et se met à jour de façon fiable — y compris dans un
 * aperçu intégré (iframe) où l’événement "resize" classique du navigateur ne se déclenche pas toujours. */
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => (typeof window !== "undefined" ? window.innerWidth < 900 : false));
  useEffect(() => {
    function check() { setIsMobile(window.innerWidth < 900); }
    check(); // s’assure que la valeur est correcte dès que la mise en page finale est prête, pas seulement au tout premier rendu
    window.addEventListener("resize", check);
    let ro;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(check);
      ro.observe(document.documentElement);
    }
    return () => { window.removeEventListener("resize", check); if (ro) ro.disconnect(); };
  }, []);
  return isMobile;
}

/**
 * Durée d'inactivité au bout de laquelle la session se ferme (en minutes).
 * Le compte à rebours ne repart qu'à une vraie action de l'agent : clic, frappe, toucher,
 * défilement. Changer d'onglet, revenir sur l'application ou recharger la page ne déconnecte
 * PAS — auparavant la session n'était pas conservée du tout, si bien qu'un simple retour sur
 * l'onglet (fréquent sur téléphone, où le navigateur décharge les pages en arrière-plan)
 * ramenait à l'écran de connexion.
 *
 * Une fois connecté dans la journée, agent comme client doit rester connecté sur son appareil
 * tant qu'il l'utilise au moins une fois toutes les 6 h — d'où un délai large plutôt que les
 * 10 minutes d'origine, pensées pour un usage bureautique classique et trop courtes pour un
 * usage ponctuel entre deux colis.
 */
const MINUTES_INACTIVITE_AGENT = 360;
const MINUTES_INACTIVITE_CLIENT = 360;
const CLE_SESSION_CLIENT = "bde-session-client";
const CLE_SESSION = "bde-session";

function lireSessionEnregistree() {
  try {
    const brut = window.localStorage.getItem(CLE_SESSION);
    if (!brut) return null;
    const { userId, derniereActivite } = JSON.parse(brut);
    if (!userId || !derniereActivite) return null;
    if (Date.now() - derniereActivite > MINUTES_INACTIVITE_AGENT * 60000) {
      window.localStorage.removeItem(CLE_SESSION);
      return null;
    }
    return userId;
  } catch (e) { return null; }
}

function lireSessionClient() {
  try {
    const brut = window.localStorage.getItem(CLE_SESSION_CLIENT);
    if (!brut) return null;
    const { compteId, derniereActivite } = JSON.parse(brut);
    if (!compteId || !derniereActivite) return null;
    if (Date.now() - derniereActivite > MINUTES_INACTIVITE_CLIENT * 60000) {
      window.localStorage.removeItem(CLE_SESSION_CLIENT);
      return null;
    }
    return compteId;
  } catch (e) { return null; }
}

function ecrireSessionClient(compteId) {
  try {
    if (!compteId) window.localStorage.removeItem(CLE_SESSION_CLIENT);
    else window.localStorage.setItem(CLE_SESSION_CLIENT, JSON.stringify({ compteId, derniereActivite: Date.now() }));
  } catch (e) {}
}

function ecrireSessionEnregistree(userId) {
  try {
    if (!userId) window.localStorage.removeItem(CLE_SESSION);
    else window.localStorage.setItem(CLE_SESSION, JSON.stringify({ userId, derniereActivite: Date.now() }));
  } catch (e) {}
}

function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [pendingSync, setPendingSync] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [showLogin, setShowLogin] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).has("connexion"));
  const [session, setSession] = useState(null);
  const [sessionRestauree, setSessionRestauree] = useState(false);

  // Restauration : on ne conserve QUE l'identifiant du compte, jamais le mot de passe ni son
  // empreinte. Le compte est relu depuis les données à chaque ouverture, donc une révocation
  // ou un changement de rôle prend effet immédiatement.
  useEffect(() => {
    if (sessionRestauree || !data || session) return;
    const userId = lireSessionEnregistree();
    if (userId) {
      const u = (data.users || []).find((x) => x.id === userId);
      if (u) setSession({ prenom: "", nom: "", email: "", telephone: "", twoFA: false, ...u });
    }
    setSessionRestauree(true);
  }, [data, session, sessionRestauree]);

  // Suivi d'activité : chaque action réelle repousse l'échéance. L'écriture est limitée à une
  // fois toutes les 20 secondes pour ne pas solliciter le stockage à chaque mouvement.
  useEffect(() => {
    if (!session) return;
    let derniereEcriture = 0;
    const marquerActivite = () => {
      const maintenant = Date.now();
      if (maintenant - derniereEcriture < 20000) return;
      derniereEcriture = maintenant;
      ecrireSessionEnregistree(session.id);
    };
    const evenements = ["click", "keydown", "touchstart", "scroll", "pointerdown"];
    evenements.forEach((e) => window.addEventListener(e, marquerActivite, { passive: true }));
    marquerActivite();

    // Contrôle périodique : au-delà du délai sans action, la session se ferme.
    const minuteur = setInterval(() => {
      if (!lireSessionEnregistree()) {
        setSession(null);
        setView("dashboard");
      }
    }, 30000);

    return () => {
      evenements.forEach((e) => window.removeEventListener(e, marquerActivite));
      clearInterval(minuteur);
    };
  }, [session]);
  const [view, setView] = useState("dashboard");
  const [toast, setToast] = useState(null);
  const [lang, setLang] = useState("fr");
  const [theme, setTheme] = useState("dark");
  const [collapsed, setCollapsed] = useState(false);
  const [adminResetKey, setAdminResetKey] = useState(0);
  const isMobile = useIsMobile();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [colisInitialQuery, setColisInitialQuery] = useState("");
  // Permet au tableau de bord de demander l'ouverture directe du formulaire de création :
  // un bouton nommé « Nouveau Colis » doit créer un colis, pas seulement changer de page.
  const [ouvrirFormulaireColis, setOuvrirFormulaireColis] = useState(0);

  useEffect(() => {
    let settled = false;
    loadData()
      .then((d) => { settled = true; setData(d); setLang(d.lang || "fr"); setTheme(d.theme || "dark"); if (d.exchangeRates) LIVE_RATES = { ...CURRENCIES, ...d.exchangeRates }; setLoading(false); autoBackupIfNeeded(d); setPendingSync(pendingSyncCount()); })
      .catch((e) => { settled = true; console.error("Échec du chargement, démarrage en mode local.", e); setOffline(true); const seed = defaultSeed(); setData(seed); setLang(seed.lang); setTheme(seed.theme); setLoading(false); });
    const timeout = setTimeout(() => {
      if (!settled) { console.error("Délai de chargement dépassé, démarrage en mode local."); setOffline(true); const seed = defaultSeed(); setData(seed); setLang(seed.lang); setTheme(seed.theme); setLoading(false); }
    }, 7000);
    return () => clearTimeout(timeout);
  }, []);

  // Synchronisation en temps réel : si un autre appareil modifie les données,
  // on les recharge ici automatiquement, sans rafraîchir la page.
  useEffect(() => {
    const unsubscribe = subscribeToChanges("bde-data", (newValueString) => {
      try {
        const next = JSON.parse(newValueString);
        setData(next);
        setTheme(next.theme || "dark");
        if (next.exchangeRates) LIVE_RATES = { ...CURRENCIES, ...next.exchangeRates };
      } catch (e) { console.error("Échec de synchronisation temps réel", e); }
    });
    return unsubscribe;
  }, []);

  // Mode hors-ligne : dès que la connexion revient, on rejoue automatiquement les modifications
  // faites pendant la coupure. Fonctionne réellement sur le site déployé (Supabase) ; dans
  // l’artefact Claude, le stockage reste toujours disponible donc rien de spécial ne se passe.
  useEffect(() => {
    async function handleOnline() {
      setIsOnline(true);
      setSyncing(true);
      try {
        const { flushed } = await flushOutbox();
        if (flushed > 0) notify(`Connexion rétablie — ${flushed} modification(s) synchronisée(s)`);
      } catch (e) { console.error("Échec de la synchronisation à la reconnexion.", e); }
      setPendingSync(pendingSyncCount());
      setSyncing(false);
    }
    function handleOffline() { setIsOnline(false); }
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    /*
     * Une session précédente peut avoir laissé des écritures en file d'attente (fenêtre fermée
     * avant la fin de la synchronisation). On tente de les rejouer dès l'ouverture plutôt que
     * d'attendre l'événement "online" (qui ne se déclenche pas si la connexion n'a jamais été
     * coupée depuis l'ouverture) ou les 20 premières secondes de la boucle ci-dessous.
     */
    if (navigator.onLine && pendingSyncCount() > 0) handleOnline();

    /*
     * Nouvelle tentative périodique.
     *
     * La file n'était rejouée qu'à l'événement "online". Or une écriture peut échouer alors que
     * la connexion est présente — coupure d'une seconde, serveur momentanément indisponible. Dans
     * ce cas l'événement "online" ne se déclenche jamais et la modification restait bloquée
     * indéfiniment, avec un bandeau permanent à l'écran.
     * On retente donc toutes les 20 secondes tant qu'il reste quelque chose en attente.
     */
    const minuteur = setInterval(async () => {
      if (!navigator.onLine || pendingSyncCount() === 0) return;
      try {
        const { flushed } = await flushOutbox();
        if (flushed > 0) setPendingSync(pendingSyncCount());
      } catch (e) { /* on retentera au prochain passage */ }
      setPendingSync(pendingSyncCount());
    }, 20000);

    /*
     * Filet de sécurité contre la perte de données : fermer l'onglet (ou le navigateur) pendant
     * qu'une écriture reste en file d'attente locale la perd définitivement — elle n'existe que
     * dans le localStorage de cet appareil précis, jamais partagée tant qu'elle n'a pas atteint
     * le serveur. C'est exactement ce qui s'est produit pour un colis créé puis introuvable :
     * l'agent a fermé la page en croyant l'enregistrement terminé. On bloque donc la fermeture
     * avec l'avertissement natif du navigateur tant qu'il reste quelque chose en attente.
     */
    function handleBeforeUnload(e) {
      if (pendingSyncCount() > 0) { e.preventDefault(); e.returnValue = ""; }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      clearInterval(minuteur);
    };
  }, []);

  /*
   * Enregistrement des données.
   *
   * L'écriture n'avait pas de gestion d'erreur : si elle échouait — serveur indisponible, quota
   * dépassé, conflit — l'agent voyait « Paiement encaissé » et passait au client suivant. Le
   * paiement disparaissait au rechargement suivant, sans que personne ne l'ait su.
   *
   * Un échec est désormais annoncé, et la modification reste dans la file d'attente : elle
   * repartira à la prochaine tentative automatique. L'agent sait qu'il doit vérifier plutôt que
   * de croire un travail enregistré alors qu'il ne l'est pas.
   */
  /*
   * persist() renvoie désormais la promesse d'enregistrement (au lieu de « tirer et oublier ») :
   * la plupart des appelants l'ignorent, comme avant, mais un appelant qui gère une donnée
   * difficile à reconstituer (ex: création d'un colis) peut l'attendre pour savoir si
   * l'enregistrement a vraiment été confirmé par le serveur ou seulement mis en file d'attente
   * locale — cas où fermer l'onglet ferait perdre la donnée pour de bon.
   */
  const persist = useCallback((next) => {
    setData(next);
    if (next.exchangeRates) LIVE_RATES = { ...CURRENCIES, ...next.exchangeRates };
    if (offline) return Promise.resolve({ queued: false });
    return saveData(next)
      .then((r) => {
        setPendingSync(pendingSyncCount());
        if (r && r.queued) {
          setToast("Enregistrement en attente — vérifiez votre connexion");
          setTimeout(() => setToast(null), 5000);
        }
        return r || {};
      })
      .catch((e) => {
        console.error("Échec de l'enregistrement", e);
        setPendingSync(pendingSyncCount());
        setToast("Enregistrement en attente — vérifiez votre connexion");
        setTimeout(() => setToast(null), 5000);
        return { queued: true, error: e };
      });
  }, [offline]);
  const notify = useCallback((msg) => { setToast(msg); setTimeout(() => setToast(null), 2800); }, []);
  function setLanguage(l) { setLang(l); persist({ ...data, lang: l }); }
  function toggleTheme() { const next = theme === "dark" ? "light" : "dark"; setTheme(next); persist({ ...data, theme: next }); }
  // Si une langue désactivée avait été enregistrée auparavant, on retombe sur le français
  // afin de ne jamais afficher un menu traduit dans une langue devenue indisponible.
  const langueActive = LANGUES_DISPONIBLES.includes(lang) ? lang : LANGUES_DISPONIBLES[0];
  const t = T[langueActive];
  const rtl = langueActive === "ar";

  const isPublicTracking = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("suivi");
  if (isPublicTracking) {
    return <Shell rtl={false} theme={theme}><PublicTrackingPage data={data} loading={loading} /></Shell>;
  }
  const isClientPortal = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("client");
  if (isClientPortal) {
    return <Shell rtl={false} theme={theme}><ClientPortalPage data={data} loading={loading} persist={persist} /></Shell>;
  }
  const isCguPage = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("cgu");
  if (isCguPage) {
    return <Shell rtl={false} theme={theme}><CguPage data={data} /></Shell>;
  }

  if (loading) {
    return <Shell rtl={false} theme={theme}><BrandedLoader /></Shell>;
  }
  if (!session && !showLogin) {
    return <Shell rtl={false} theme={theme}><SiteVitrineHomePage data={data} onConnexionClick={() => { setShowLogin(true); const url = new URL(window.location.href); url.searchParams.set("connexion", "1"); window.history.replaceState({}, "", url); }} /></Shell>;
  }
  if (!session) {
    return <Shell rtl={false} theme={theme}><Login users={data.users} onLogin={(u) => {
      const normalized = { prenom: "", nom: "", email: "", telephone: "", twoFA: false, ...u };
      setSession(normalized);
      ecrireSessionEnregistree(normalized.id);
      setView("dashboard");
      try { persist({ ...data, users: (data.users || []).map((x) => (x.id === u.id ? normalized : x)) }); }
      catch (ex) { console.error("Migration du compte impossible :", ex); }
    }} offline={offline} theme={theme} onToggleTheme={toggleTheme} onBackToHome={() => { setShowLogin(false); const url = new URL(window.location.href); url.searchParams.delete("connexion"); window.history.replaceState({}, "", url); }} /></Shell>;
  }

  const canAdmin = session.role === "Administrateur";
  const canOps = session.role === "Administrateur" || session.role === "Agent";
  const canFinance = session.role === "Administrateur" || session.role === "Comptable";
  const perm = (key) => effectivePermission(session, key);

  const preAlertesEnAttente = (data.preAlertes || []).filter((p) => p.statut === "En attente").length;
  const declarationsEnAttente = data.colis.reduce((s, c) => s + (c.declarationsPaiement || []).filter((d) => d.statut === "En attente").length, 0);
  const signalementsOuvertsCount = data.colis.reduce((s, c) => s + (c.signalements || []).filter((sig) => sig.statut === "Ouvert").length, 0);
  const expressEnAttenteCount = data.colis.filter((c) => c.demandeExpress && c.demandeExpress.statut === "En attente").length;
  const centreClientsEnAttente = (data.clientAccounts || []).filter((c) => (c.messages || []).some((m) => m.expediteur === "client" && !m.lu)).length
    + preAlertesEnAttente
    + (data.demandesRegroupement || []).filter((r) => r.statut === "En attente").length
    + signalementsOuvertsCount
    + expressEnAttenteCount;
  const nav = [
    { key: "dashboard", label: t.dashboard, icon: LayoutDashboard, show: true },
    { key: "colis", label: t.colis, icon: Package, show: perm("colis.voir_propres") || perm("colis.voir_tous") },
    { key: "centreclients", label: "Centre clients", icon: MessageCircle, show: perm("espaceclient.gerer"), badge: centreClientsEnAttente },
    { key: "clients", label: t.clients, icon: Users, show: perm("clients.consulter") },
    { key: "bordereaux", label: t.bordereaux, icon: FileStack, show: perm("bordereaux.consulter") },
    { key: "paiements", label: t.paiements, icon: Receipt, show: perm("factures.consulter"), badge: declarationsEnAttente },
    { key: "comptabilite", label: "Comptabilité", icon: DollarSign, show: perm("compta.consulter") },
    { key: "ia", label: t.ia, icon: Sparkles, show: perm("ia.utiliser") },
    { key: "admin", label: t.admin, icon: Settings, show: perm("config.acceder") },
  ].filter((n) => n.show);

  return (
    <Shell rtl={rtl} theme={theme}>
      <div style={{ display: "flex", minHeight: "100vh", background: "var(--surface2)" }}>
        {isMobile && mobileNavOpen && (
          <div onClick={() => setMobileNavOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 40 }} />
        )}
        <aside style={{
          width: isMobile ? 240 : (collapsed ? 72 : 240),
          transition: isMobile ? "transform 0.2s ease" : "width 0.18s ease",
          background: "#0A2647", color: "#fff", display: "flex", flexDirection: "column", flexShrink: 0,
          position: isMobile ? "fixed" : "relative", insetInlineStart: 0, top: 0, bottom: 0, zIndex: 41,
          transform: isMobile ? (mobileNavOpen ? "translateX(0)" : (rtl ? "translateX(100%)" : "translateX(-100%)")) : "none",
        }}>
          {!isMobile && (
            <button onClick={() => setCollapsed((c) => !c)} title={collapsed ? "Déplier le menu" : "Replier le menu"} style={{
              position: "absolute", top: 22, insetInlineEnd: -12, width: 24, height: 24, borderRadius: "50%",
              background: "var(--brand-solid)", border: "2px solid var(--surface2)", color: "#fff", cursor: "pointer", display: "grid", placeItems: "center", zIndex: 5,
            }}>
              {(collapsed && !rtl) || (!collapsed && rtl) ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
            </button>
          )}
          {isMobile && (
            <button onClick={() => setMobileNavOpen(false)} style={{ position: "absolute", top: 18, insetInlineEnd: 14, width: 30, height: 30, borderRadius: 8, background: "rgba(255,255,255,0.1)", border: "none", color: "#fff", cursor: "pointer", display: "grid", placeItems: "center", zIndex: 5 }}>
              <X size={16} />
            </button>
          )}
          <div style={{ padding: (collapsed && !isMobile) ? "22px 10px" : "22px 20px", borderBottom: "1px solid rgba(255,255,255,0.12)", overflow: "hidden" }}>
            {(collapsed && !isMobile) ? (
              <img src={data.branding?.logo || DEFAULT_LOGO} alt="logo" style={{ width: 28, height: 28, borderRadius: 6, objectFit: "cover", margin: "0 auto", display: "block" }} />
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <img src={data.branding?.logo || DEFAULT_LOGO} alt="logo" style={{ width: 26, height: 26, borderRadius: 6, objectFit: "cover" }} />
                  <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 18, whiteSpace: "nowrap" }}>
                    {data.branding?.nom ? data.branding.nom : <>BA-DIABY <span style={{ color: "var(--brand-on-dark)" }}>EXPRESS</span></>}
                  </div>
                </div>
                <div style={{ fontSize: 11.5, color: "var(--nav-muted)", marginTop: 3, whiteSpace: "nowrap" }}>{data.branding?.tagline || "Gestion des colis · Conakry - Monde"}</div>
              </>
            )}
          </div>
          <div style={{ padding: "0 12px 8px" }}>
            <button onClick={() => setShowGlobalSearch(true)} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", justifyContent: (collapsed && !isMobile) ? "center" : "flex-start", background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 8, padding: (collapsed && !isMobile) ? "9px 0" : "9px 12px", color: "rgba(255,255,255,0.7)", fontSize: 13, cursor: "pointer" }}>
              <Search size={15} /> {!(collapsed && !isMobile) && "Recherche globale"}
            </button>
          </div>
          <nav style={{ padding: 12, display: "flex", flexDirection: "column", gap: 3, flex: 1, overflowY: "auto" }}>
            {nav.map((n) => (
              <button key={n.key} onClick={() => { setView(n.key); if (n.key === "admin") setAdminResetKey((k) => k + 1); setMobileNavOpen(false); }} title={(collapsed && !isMobile) ? n.label : undefined} style={{
                display: "flex", alignItems: "center", gap: 10, padding: (collapsed && !isMobile) ? "10px 0" : "10px 12px", justifyContent: (collapsed && !isMobile) ? "center" : "flex-start",
                borderRadius: 8, background: view === n.key ? "var(--brand-solid)" : "transparent", color: "#fff", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 600, textAlign: "start", position: "relative",
              }}>
                <n.icon size={17} /> {!(collapsed && !isMobile) && n.label}
                {!!n.badge && (
                  <span style={{
                    position: (collapsed && !isMobile) ? "absolute" : "static", top: (collapsed && !isMobile) ? 4 : undefined, right: (collapsed && !isMobile) ? 10 : undefined,
                    marginInlineStart: (collapsed && !isMobile) ? 0 : "auto", background: "#E0A63A", color: "#0A2647", borderRadius: 20, fontSize: 10.5, fontWeight: 700, padding: "1px 6px", minWidth: 16, textAlign: "center",
                  }}>{n.badge}</span>
                )}
              </button>
            ))}
          </nav>
          <div style={{ padding: (collapsed && !isMobile) ? "14px 8px" : 14, borderTop: "1px solid rgba(255,255,255,0.12)" }}>
            {!(collapsed && !isMobile) && (
              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                {(LANGUES_DISPONIBLES.length > 1 ? LANGUES_DISPONIBLES : []).map((l) => (
                  <button key={l} onClick={() => setLanguage(l)} style={{ flex: 1, minHeight: 40, padding: "10px 0", borderRadius: 8, border: "1px solid rgba(255,255,255,0.2)", background: lang === l ? "var(--brand-solid)" : "transparent", color: "#fff", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>{l.toUpperCase()}</button>
                ))}
              </div>
            )}
            <button onClick={toggleTheme} title={theme === "dark" ? "Mode clair" : "Mode sombre"} style={{
              display: "flex", alignItems: "center", justifyContent: (collapsed && !isMobile) ? "center" : "flex-start", gap: 8, width: "100%",
              padding: "7px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.2)", background: "transparent", color: "#fff", fontSize: 12, cursor: "pointer", marginBottom: (collapsed && !isMobile) ? 10 : 12,
            }}>
              {theme === "dark" ? <Moon size={14} /> : <Sun size={14} />} {!(collapsed && !isMobile) && (theme === "dark" ? "Mode sombre" : "Mode clair")}
            </button>
            {!(collapsed && !isMobile) && (
              <>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{session.prenom} {session.nom}</div>
                <div style={{ fontSize: 11.5, color: "var(--nav-muted)", marginBottom: 10 }}>{session.role}</div>
              </>
            )}
            <button onClick={() => { ecrireSessionEnregistree(null); setSession(null); setView("dashboard"); setShowLogin(false); const url = new URL(window.location.href); url.searchParams.delete("connexion"); window.history.replaceState({}, "", url); }} title={(collapsed && !isMobile) ? t.logout : undefined} style={{ display: "flex", alignItems: "center", justifyContent: (collapsed && !isMobile) ? "center" : "flex-start", gap: 8, width: "100%", fontSize: 13, color: "var(--brand-on-dark)", background: "none", border: "none", cursor: "pointer" }}>
              <LogOut size={15} /> {!(collapsed && !isMobile) && t.logout}
            </button>
          </div>
        </aside>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          {isMobile && (
            <div style={{ position: "sticky", top: 0, zIndex: 20, display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "#0A2647", color: "#fff" }}>
              <button onClick={() => setMobileNavOpen(true)} style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 8, width: 34, height: 34, display: "grid", placeItems: "center", color: "#fff", cursor: "pointer", flexShrink: 0 }}>
                <Menu size={18} />
              </button>
              <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>
                {nav.find((n) => n.key === view)?.label || (data.branding?.nom || "BA-DIABY EXPRESS")}
              </div>
              <button onClick={() => setShowGlobalSearch(true)} style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 8, width: 34, height: 34, display: "grid", placeItems: "center", color: "#fff", cursor: "pointer", flexShrink: 0 }}>
                <Search size={16} />
              </button>
            </div>
          )}
          <main style={{ flex: 1, padding: isMobile ? "16px 14px" : "28px 32px", overflowY: "auto", minWidth: 0 }}>
            {view === "dashboard" && (session.role === "Partenaire" ? <PartnerDashboard data={data} session={session} /> : <Dashboard data={data} session={session} onNavigate={setView} onNouveauColis={() => { setView("colis"); setOuvrirFormulaireColis((n) => n + 1); }} />)}
            {view === "colis" && <ColisView data={data} persist={persist} session={session} notify={notify} t={t} initialQuery={colisInitialQuery} ouvrirFormulaire={ouvrirFormulaireColis} />}
            {view === "centreclients" && (effectivePermission(session, "espaceclient.gerer")
              ? <CentreClientsPage data={data} persist={persist} notify={notify} session={session} />
              : <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 30, textAlign: "center", color: "var(--muted)", fontSize: 13.5 }}>
                  Vous n’êtes pas autorisé à traiter les demandes de l’Espace Client. Demandez l’accès à un administrateur.
                </div>)}
            {view === "clients" && <Clients data={data} />}
            {view === "bordereaux" && <BordereauxPage data={data} persist={persist} session={session} notify={notify} />}
            {view === "paiements" && <PaiementsPage data={data} notify={notify} />}
            {view === "comptabilite" && <ComptabilitePage data={data} persist={persist} session={session} notify={notify} />}
            {view === "ia" && <AiAssistant data={data} />}
            {view === "admin" && perm("config.acceder") && <ConfigurationHub key={adminResetKey} data={data} persist={persist} session={session} notify={notify} onNavigateApp={setView} offline={offline} />}
          </main>
        </div>
      </div>
      {showGlobalSearch && <GlobalSearchModal data={data} onClose={() => setShowGlobalSearch(false)} onOpenColis={(tracking) => { setView("colis"); setShowGlobalSearch(false); setColisInitialQuery(tracking); }} onOpenClient={() => { setView("clients"); setShowGlobalSearch(false); }} onOpenPreAlerte={() => { setView("centreclients"); setShowGlobalSearch(false); }} />}
      {/*
        Bandeau d'état de la connexion.

        Il était affiché en haut, par-dessus le titre de la page : sur téléphone il masquait
        « Bonsoir, Ibrahima » en permanence dès qu'une écriture attendait. Or une synchronisation
        en attente n'est pas une erreur — le travail est enregistré, il partira tout seul. Le
        bandeau est donc déplacé en bas de l'écran, discret, et ne s'affiche que si l'attente
        dure : inutile de signaler une seconde de latence.
        La perte de connexion, elle, reste bien visible : l'agent doit le savoir.
      */}
      {(!isOnline || pendingSync > 0) && (
        <div style={{ position: "fixed", bottom: 18, insetInlineStart: "50%", transform: "translateX(-50%)", zIndex: 60,
                      background: isOnline ? "var(--surface2)" : "var(--danger-bg)",
                      border: "1px solid " + (isOnline ? "var(--border)" : "var(--danger-border)"),
                      color: isOnline ? "var(--muted)" : "var(--danger-fg)",
                      padding: "7px 14px", borderRadius: 20, fontSize: 11.5, fontWeight: 600,
                      display: "flex", alignItems: "center", gap: 7, maxWidth: "92vw",
                      boxShadow: "0 4px 14px rgba(0,0,0,0.18)" }}>
          {isOnline ? <RefreshCw size={12} /> : <AlertTriangle size={12} />}
          {!isOnline
            ? "Hors ligne — vos modifications partiront au retour de la connexion"
            : syncing ? "Enregistrement…" : `${pendingSync} en attente d’enregistrement`}
        </div>
      )}
      {toast && <div style={{ position: "fixed", bottom: 24, insetInlineEnd: 24, insetInlineStart: isMobile ? 24 : "auto", background: "#0A2647", color: "#fff", padding: "12px 18px", borderRadius: 12, fontSize: 13.5, boxShadow: "0 8px 24px rgba(10,38,71,0.3)", textAlign: "center" }}>{toast}</div>}
    </Shell>
  );
}

/**
 * Recherche globale — trouve un colis (par n° de suivi ou nom), un client (compte Espace
 * Client), ou une pré-alerte, depuis n’importe où dans l’application, sans devoir naviguer
 * entre les pages pour deviner où chercher.
 */
/**
 * Recherche par scan — ouvre la caméra et lit le QR code de l’étiquette (qui pointe vers la
 * page de suivi publique) pour retrouver le colis sans taper son numéro.
 *
 * Fonctionne sur la quasi-totalité des téléphones et navigateurs modernes (Chrome/Android,
 * Safari/iPhone, Firefox) car il repose sur deux standards très largement supportés :
 * getUserMedia (accès caméra) et, pour la lecture du QR, soit l’API native BarcodeDetector
 * (Chrome/Edge/Android — lit aussi le code-barres de l’étiquette), soit la librairie jsQR en
 * repli (tous les autres navigateurs, dont Safari/iPhone — lecture QR uniquement).
 *
 * Cas où ça ne peut pas fonctionner, quel que soit l’appareil : site chargé en http:// non
 * sécurisé (la caméra exige https, sauf en local), permission caméra refusée, ou aucune caméra
 * détectée sur l’appareil. Dans ces cas, un message clair explique le problème plutôt que
 * d’échouer silencieusement.
 */
function ScannerModal({ onClose, onScan }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const [etat, setEtat] = useState("demarrage"); // demarrage | actif | erreur
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    let annule = false;
    async function demarrer() {
      if (window.isSecureContext === false) {
        setErreur("La caméra nécessite une connexion sécurisée (https://). Ouvrez l’application via son adresse habituelle plutôt qu’en http.");
        setEtat("erreur");
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setErreur("Ce navigateur ne permet pas d’accéder à la caméra. Essayez avec une version récente de Chrome, Safari ou Firefox, ou tapez le numéro manuellement.");
        setEtat("erreur");
        return;
      }
      let stream;
      try {
        // "ideal" plutôt que la caméra arrière imposée : certains appareils (ordinateurs,
        // anciens téléphones) n’ont qu’une seule caméra et rejetteraient une contrainte stricte.
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } } });
      } catch (e1) {
        try { stream = await navigator.mediaDevices.getUserMedia({ video: true }); }
        catch (e2) {
          console.error("Accès caméra impossible.", e2);
          const msg = e2?.name === "NotAllowedError"
            ? "L’accès à la caméra a été refusé. Autorisez la caméra pour ce site dans les réglages de votre navigateur, puis réessayez."
            : e2?.name === "NotFoundError"
            ? "Aucune caméra détectée sur cet appareil."
            : "Impossible d’accéder à la caméra. Tapez le numéro manuellement.";
          setErreur(msg);
          setEtat("erreur");
          return;
        }
      }
      if (annule) { stream.getTracks().forEach((t) => t.stop()); return; }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try { await videoRef.current.play(); } catch { /* le play() automatique peut être bloqué sur certains iPhones tant que l’utilisateur n’a pas interagi ; la balise video reste visible et se lance dès le premier tap */ }
      }
      setEtat("actif");
      lancerBoucleDetection();
    }

    async function lancerBoucleDetection() {
      let detector = null;
      if ("BarcodeDetector" in window) {
        try { detector = new window.BarcodeDetector({ formats: ["qr_code", "code_128"] }); } catch { /* repli jsQR ci-dessous */ }
      }
      if (!detector) await ensureJsQR();

      const boucle = async () => {
        if (annule || !videoRef.current || videoRef.current.readyState < 2) { rafRef.current = requestAnimationFrame(boucle); return; }
        try {
          if (detector) {
            const codes = await detector.detect(videoRef.current);
            if (codes.length > 0) { onScan(codes[0].rawValue); return; }
          } else if (window.jsQR) {
            const canvas = canvasRef.current;
            const w = videoRef.current.videoWidth, h = videoRef.current.videoHeight;
            if (w && h) {
              canvas.width = w; canvas.height = h;
              const ctx = canvas.getContext("2d");
              ctx.drawImage(videoRef.current, 0, 0, w, h);
              const imgData = ctx.getImageData(0, 0, w, h);
              const resultat = window.jsQR(imgData.data, w, h, { inversionAttempts: "attemptBoth" });
              if (resultat) { onScan(resultat.data); return; }
            }
          }
        } catch (e) { /* frame illisible, on continue */ }
        rafRef.current = requestAnimationFrame(boucle);
      };
      rafRef.current = requestAnimationFrame(boucle);
    }

    demarrer();
    return () => {
      annule = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <Modal onClose={onClose} title="Scanner un colis">
      {etat === "erreur" ? (
        <div style={{ fontSize: 13, color: "var(--danger-fg)", padding: "16px 0", lineHeight: 1.6 }}>{erreur}</div>
      ) : (
        <div>
          <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", background: "#000", aspectRatio: "1" }}>
            <video ref={videoRef} muted autoPlay playsInline webkit-playsinline="true" style={{ width: "100%", height: "100%", objectFit: "cover" }} onClick={(e) => e.currentTarget.play().catch(() => {})} />
            <div style={{ position: "absolute", inset: "18%", border: "2.5px solid #3ECB84", borderRadius: 12, boxShadow: "0 0 0 2000px rgba(0,0,0,0.35)" }} />
          </div>
          <canvas ref={canvasRef} style={{ display: "none" }} />
          <div style={{ fontSize: 12, color: "var(--muted)", textAlign: "center", marginTop: 12 }}>
            {etat === "demarrage" ? "Activation de la caméra…" : "Visez le QR code sur l’étiquette du colis"}
          </div>
        </div>
      )}
    </Modal>
  );
}

function GlobalSearchModal({ data, onClose, onOpenColis, onOpenClient, onOpenPreAlerte }) {
  const [q, setQ] = useState("");
  const deferredQ = useDeferredValue(q);
  const query = pourRecherche(deferredQ.trim());

  const resultats = useMemo(() => {
    if (query.length < 2) return { colis: [], clients: [], preAlertes: [] };
    const colis = data.colis.filter((c) => pourRecherche(c.tracking).includes(query) || pourRecherche(c.destinataire).includes(query) || (c.telephone || "").includes(query)).slice(0, 8);
    const clients = (data.clientAccounts || []).filter((c) => pourRecherche(`${c.prenom} ${c.nom}`).includes(query) || (c.telephone || "").includes(query)).slice(0, 6);
    const preAlertes = (data.preAlertes || []).filter((p) => pourRecherche(p.trackingExterne).includes(query)).slice(0, 6);
    return { colis, clients, preAlertes };
  }, [data.colis, data.clientAccounts, data.preAlertes, query]);

  const rien = resultats.colis.length === 0 && resultats.clients.length === 0 && resultats.preAlertes.length === 0;

  return (
    <Modal onClose={onClose} title="Recherche globale" wide>
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--surface2)", border: "1.5px solid var(--border)", borderRadius: 8, padding: "10px 14px", marginBottom: 18 }}>
        <Search size={16} color="var(--muted)" />
        <input value={q} onChange={(e) => setQ(e.target.value)} autoFocus placeholder="N° de suivi, nom du client, téléphone, référence de pré-alerte..." style={{ border: "none", outline: "none", flex: 1, fontSize: 14, background: "none", color: "var(--text)" }} />
      </div>

      {query.length < 2 ? (
        <div style={{ fontSize: 12.5, color: "var(--muted)", textAlign: "center", padding: 20 }}>Tapez au moins 2 caractères pour lancer la recherche.</div>
      ) : rien ? (
        <div style={{ fontSize: 12.5, color: "var(--muted)", textAlign: "center", padding: 20 }}>Aucun résultat pour "{q}".</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {resultats.colis.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", marginBottom: 8 }}>COLIS ({resultats.colis.length})</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {resultats.colis.map((c) => {
                  const st = STATUS_STYLE[c.status];
                  return (
                    <button key={c.tracking} onClick={() => onOpenColis(c.tracking)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--surface2)", border: "none", borderRadius: 8, padding: "10px 14px", cursor: "pointer", textAlign: "start" }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{c.tracking} — {c.destinataire}</div>
                        <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{routeLabel(c.pays, c.direction)}</div>
                      </div>
                      <span style={{ background: st?.bg, color: st?.fg, padding: "3px 9px", borderRadius: 20, fontSize: 10.5, fontWeight: 700 }}>{c.status}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {resultats.clients.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", marginBottom: 8 }}>CLIENTS ({resultats.clients.length})</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {resultats.clients.map((c) => (
                  <button key={c.id} onClick={() => onOpenClient(c)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--surface2)", border: "none", borderRadius: 8, padding: "10px 14px", cursor: "pointer", textAlign: "start" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{c.prenom} {c.nom}</div>
                    <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{c.telephone}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
          {resultats.preAlertes.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", marginBottom: 8 }}>PRÉ-ALERTES ({resultats.preAlertes.length})</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {resultats.preAlertes.map((p) => (
                  <button key={p.id} onClick={() => onOpenPreAlerte(p)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--surface2)", border: "none", borderRadius: 8, padding: "10px 14px", cursor: "pointer", textAlign: "start" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{p.trackingExterne}{p.description ? ` — ${p.description}` : ""}</div>
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>{p.statut}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function Shell({ children, rtl, theme }) {
  return (
    <div dir={rtl ? "rtl" : "ltr"} data-theme={theme || "dark"}>
      <style>{`
        @import url('${FONT_LINK}');
        * { box-sizing: border-box; }
        :root, [data-theme="dark"] {
          --bg: #0A0F1C; --surface: #131A2B; --surface2: #1B2438; --border: #242E47; --text: #F1F4FA; --muted: #8A97B5;
          /* Couleurs sémantiques : fonds, bordures et textes des blocs d’état (succès, alerte,
             erreur, information). Déclinées par thème afin qu’un encart ne reste jamais sombre
             sur une page claire — c’était la principale incohérence visuelle du site. */
          --danger-bg: #2B1620; --danger-border: #4A2530; --danger-fg: #FF6B7D; --danger-fg-soft: #F5B8C0;
          --warn-bg: #2B2313; --warn-border: #4A3D1A; --warn-fg: #E0A63A; --warn-fg-soft: #F0CE8E;
          --ok-bg: #0F2A1C; --ok-bg-soft: #12261D; --ok-border: #1E4A32; --ok-fg: #3ECB84; --ok-fg-alt: #2FAE73;
          --info-bg: #16233F; --info-bg-alt: #0F2A3D; --info-border: #1E4A6B; --info-fg: #5B8DEF; --info-fg-soft: #B9CDF7;
          --neutral-fg: #AEB9D6; --bronze-bg: #1B140F; --placeholder: #6B77A0;
        }
        [data-theme="light"] {
          --bg: #F3F5FA; --surface: #FFFFFF; --surface2: #EEF1F8; --border: #DCE2F0; --text: #101828; --muted: #5B6B82;
          --danger-bg: #FEF1F3; --danger-border: #F6CBD2; --danger-fg: #B3243A; --danger-fg-soft: #8E1A2A;
          --warn-bg: #FFF8E7; --warn-border: #EFD9A2; --warn-fg: #8A6008; --warn-fg-soft: #6F4D06;
          --ok-bg: #EAF9F0; --ok-bg-soft: #F1FBF5; --ok-border: #BCE5CC; --ok-fg: #107442; --ok-fg-alt: #0F6A43;
          --info-bg: #EEF3FE; --info-bg-alt: #E7EFFD; --info-border: #C3D6F7; --info-fg: #24559B; --info-fg-soft: #1C4483;
          --neutral-fg: #4E5D75; --bronze-bg: #FBF3EC; --placeholder: #98A2B6;
        }
        /* La barre latérale reste bleu marine dans les deux thèmes : ses couleurs de texte ne
           doivent donc PAS suivre le thème, sinon le texte secondaire devient foncé sur foncé
           en mode clair (illisible). Ces trois valeurs sont volontairement fixes.
           --brand-solid : rouge de marque assombri pour atteindre un contraste suffisant avec
           du texte blanc (l’ancien #E23F52 plafonnait à 4,1:1, sous le minimum de 4,5:1). */
        :root { --nav-fg: #FFFFFF; --nav-muted: #A9B6D0; --brand-on-dark: #FF7183; --brand-solid: #CE1B33; }
        /* Filet de sécurité contre le défilement horizontal de la page entière sur mobile : un
           bouton, un badge ou un texte trop large quelque part suffit sinon à décaler tout
           l'écran vers la droite (titre et libellés partiellement coupés à gauche). Les zones
           qui ont légitimement besoin de défiler horizontalement (tableaux larges...) gardent
           leur propre défilement local (overflow-x auto) et ne sont pas affectées par cette
           règle globale. */
        html, body { overflow-x: hidden; max-width: 100%; }
        body { margin: 0; background: var(--bg); }
        input, select, button { font-family: 'Inter', sans-serif; }
        input, select { color: var(--text); }
        ::placeholder { color: var(--placeholder); }
        /* Ergonomie tactile : sur téléphone, une cible doit mesurer au moins 44 px (recommandation
           Apple et Google). Plusieurs boutons descendaient à 30 px, et "Déconnexion" à 17 px, ce
           qui les rendait difficiles à toucher précisément. */
        @media (max-width: 640px) {
          button, [role="button"], select { min-height: 44px; }
          button { min-width: 40px; }
          input:not([type="checkbox"]):not([type="radio"]):not([type="file"]) { min-height: 44px; }
        }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 8px; }

        /* --- Adaptation mobile --- */
        /* Tout conteneur qui contient directement une table devient défilable horizontalement,
           pour que les tableaux ne débordent jamais de l’écran sur mobile. */
        div:has(> table) { overflow-x: auto; -webkit-overflow-scrolling: touch; }
        table { min-width: 560px; }
        @media (max-width: 768px) {
          /* Empêche le zoom automatique sur iOS quand on touche un champ (nécessite 16px minimum) */
          input, select, textarea { font-size: 16px !important; }
          /* Les grilles à 2 colonnes fixes passent à 1 colonne sur petit écran */
          .responsive-grid-2 { grid-template-columns: 1fr !important; }
          /* Les cartes de statistiques restent lisibles */
          h1 { font-size: 20px !important; }
        }

        /* --- Anneau rotatif des destinations (page d’accueil publique) --- */
        @keyframes bde-ring-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes bde-ring-spin-reverse { from { transform: rotate(0deg); } to { transform: rotate(-360deg); } }
        .bde-ring { animation: bde-ring-spin 40s linear infinite; }
        .bde-ring:hover { animation-play-state: paused; }
        .bde-ring-item-inner { animation: bde-ring-spin-reverse 40s linear infinite; }
        .bde-ring:hover .bde-ring-item-inner { animation-play-state: paused; }
        @keyframes bde-package-float { 0%, 100% { transform: translateY(0) rotate(-4deg); } 50% { transform: translateY(-8px) rotate(4deg); } }
        .bde-package-center { animation: bde-package-float 3s ease-in-out infinite; }

        /* --- Écran de chargement animé --- */
        @keyframes bde-pulse-ring { 0% { transform: scale(0.9); opacity: 0.7; } 70% { transform: scale(1.25); opacity: 0; } 100% { transform: scale(1.25); opacity: 0; } }
        @keyframes bde-logo-bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
      `}</style>
      {children}
    </div>
  );
}

/** Écran de chargement animé avec le logo, affiché pendant le chargement initial (utile quand le réseau est lent). */
function BrandedLoader() {
  return (
    <div style={{ display: "grid", placeItems: "center", height: "100vh", background: "var(--bg)" }}>
      <div style={{ position: "relative", width: 90, height: 90, display: "grid", placeItems: "center", marginBottom: 22 }}>
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "3px solid var(--brand-solid)", animation: "bde-pulse-ring 1.8s cubic-bezier(0.4,0,0.6,1) infinite" }} />
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "3px solid var(--brand-solid)", animation: "bde-pulse-ring 1.8s cubic-bezier(0.4,0,0.6,1) infinite 0.6s" }} />
        <div style={{ width: 60, height: 60, borderRadius: "50%", background: "#0A2647", display: "grid", placeItems: "center", animation: "bde-logo-bounce 1.8s ease-in-out infinite" }}>
          <Package size={28} color="#fff" />
        </div>
      </div>
      <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 17, color: "var(--text)" }}>
        BA-DIABY <span style={{ color: "var(--danger-fg)" }}>EXPRESS</span>
      </div>
      <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 4 }}>Chargement…</div>
    </div>
  );
}

/**
 * Page de suivi public — accessible sans connexion via l’URL "?suivi=1".
 * N’affiche QUE des informations non sensibles : statut, route, poids, dates.
 * Ne montre JAMAIS le prix, le paiement, le téléphone, l’adresse détaillée ou les notes internes.
 */
/**
 * Conditions Générales d’Utilisation & Politique de confidentialité — page publique,
 * accessible via "?cgu=1". Nécessaire dès lors que le site collecte des données de clients
 * (téléphone, adresse, e-mail) via l’inscription et les pré-alertes.
 */
function CguPage({ data }) {
  // Le hook fournit "lang" utilisé plus bas pour la direction du texte (arabe = RTL).
  // Son absence provoquait un ReferenceError qui plantait la page.
  const [lang] = useClientLang();
  const entreprise = data?.entreprise || { adresseSiege: "Conakry, Guinée", telephone: "+224612479339", email: "badiabyexpress.bde@gmail.com", siteWeb: "www.ba-diaby-express.com" };
  const section = (titre, children) => (
    <div style={{ marginBottom: 26 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>{titre}</div>
      <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.7 }}>{children}</div>
    </div>
  );
  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"} style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "40px 20px 60px" }}>
        <button onClick={() => { window.location.href = "/"; }} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "var(--muted)", fontSize: 13, cursor: "pointer", marginBottom: 24 }}>
          <ChevronLeft size={15} /> Retour à l’accueil
        </button>
        <h1 style={{ fontFamily: "'Space Grotesk',sans-serif", color: "var(--text)", fontSize: 24, marginBottom: 6 }}>Conditions générales & confidentialité</h1>
        <p style={{ color: "var(--muted)", fontSize: 12.5, marginBottom: 30 }}>Dernière mise à jour : {new Date().toLocaleDateString("fr-FR", { year: "numeric", month: "long" })}</p>

        {section("1. Qui sommes-nous", <>Ba-Diaby Express est une entreprise de transport de colis entre la Guinée et plusieurs destinations internationales, dont le siège se trouve à {entreprise.adresseSiege}. Vous pouvez nous contacter au {entreprise.telephone} ou par e-mail à {entreprise.email}.</>)}

        {section("2. Données que nous collectons", <>
          Lorsque vous créez un compte client, enregistrez une pré-alerte, ou qu’un colis est enregistré à votre nom, nous collectons : votre nom et prénom, votre numéro de téléphone, votre adresse postale, votre adresse e-mail (si fournie), ainsi que les informations liées à vos colis (poids, contenu déclaré, montants facturés et payés, historique de statut).
        </>)}

        {section("3. Pourquoi nous les utilisons", <>
          Ces informations servent uniquement à assurer le suivi de vos colis, à vous permettre de consulter votre espace client, à calculer les montants dus, à vous contacter en cas de besoin concernant une livraison, et à établir nos documents (factures, tickets, bordereaux). Nous ne vendons ni ne partageons vos données avec des tiers à des fins commerciales.
        </>)}

        {section("4. Conservation des données", <>
          Vos données sont conservées aussi longtemps que votre compte reste actif, et pour la durée nécessaire au respect de nos obligations comptables et légales. Vous pouvez demander la suppression de votre compte à tout moment en nous contactant directement.
        </>)}

        {section("5. Vos droits", <>
          Vous pouvez à tout moment consulter et corriger vos informations personnelles depuis la section "Mon profil" de votre espace client, ou nous contacter pour toute demande de rectification, d’accès ou de suppression de vos données.
        </>)}

        {section("6. Sécurité", <>
          Votre mot de passe est protégé par un chiffrement à sens unique (haché et salé) — nous ne pouvons jamais le consulter en clair, y compris notre propre personnel. L’accès à votre espace client nécessite votre identifiant et votre mot de passe.
        </>)}

        {section("7. Conditions de transport", <>
          Tout colis confié à Ba-Diaby Express doit être correctement déclaré (contenu, poids, valeur). Ba-Diaby Express se réserve le droit de refuser tout colis dont le contenu serait interdit au transport international ou national. Le délai de livraison indiqué est une estimation et peut varier selon les conditions de transport. Le paiement du solde restant est exigible avant la remise du colis au destinataire.
        </>)}

        {section("8. Contact", <>
          Pour toute question relative à ces conditions ou à vos données personnelles : {entreprise.email} — {entreprise.telephone}.
        </>)}

        <div style={{ textAlign: "center", fontSize: 11, color: "var(--muted)", marginTop: 40, paddingTop: 20, borderTop: "1px solid var(--border)" }}>
          Ba-Diaby Express — Transport de colis Conakry - Monde
        </div>
      </div>
    </div>
  );
}


/**
 * Traductions de l’ESPACE CLIENT et de la PAGE DE SUIVI PUBLIC (les deux seules surfaces vues
 * par des clients à l’étranger : France, Belgique, Canada, États-Unis, Maroc).
 * Le back-office reste en français, langue de travail de l’équipe à Conakry.
 * Le dictionnaire est indexé par le texte français lui-même : toute chaîne non traduite
 * s’affiche donc simplement en français au lieu de disparaître.
 */
const CLIENT_I18N = {
  "Espace Client": { en: "Client Area", ar: "مساحة العميل" },
  "Ba-Diaby Express — Transport de colis Conakry - Monde": { en: "Ba-Diaby Express — Parcel transport Conakry ⇄ Worldwide", ar: "با-ديابي إكسبريس — نقل الشحنات كوناكري ⇄ العالم" },
  "Suivi de colis": { en: "Parcel tracking", ar: "تتبع الشحنة" },
  "Se connecter": { en: "Sign in", ar: "تسجيل الدخول" },
  "Déconnexion": { en: "Sign out", ar: "تسجيل الخروج" },
  "Créer un compte": { en: "Create an account", ar: "إنشاء حساب" },
  "Créer mon compte": { en: "Create my account", ar: "إنشاء حسابي" },
  "Créer mon compte client": { en: "Create my client account", ar: "إنشاء حساب عميل" },
  "Création…": { en: "Creating…", ar: "جارٍ الإنشاء…" },
  "J’ai déjà un compte — me connecter": { en: "I already have an account — sign in", ar: "لدي حساب بالفعل — تسجيل الدخول" },
  "Retour à la connexion": { en: "Back to sign in", ar: "العودة إلى تسجيل الدخول" },
  "Mot de passe oublié": { en: "Forgot password", ar: "نسيت كلمة المرور" },
  "Mot de passe oublié ?": { en: "Forgot your password?", ar: "هل نسيت كلمة المرور؟" },
  "Saisissez votre identifiant : nous enverrons un code de vérification sur le WhatsApp associé à votre compte.": { en: "Enter your username: we will send a verification code to the WhatsApp linked to your account.", ar: "أدخل اسم المستخدم: سنرسل رمز تحقق إلى واتساب المرتبط بحسابك." },
  "Recevoir le code": { en: "Send me the code", ar: "أرسل لي الرمز" },
  "Code de vérification": { en: "Verification code", ar: "رمز التحقق" },
  "Nous avons envoyé un code à 6 chiffres sur le WhatsApp du": { en: "We sent a 6-digit code to the WhatsApp of", ar: "أرسلنا رمزًا من 6 أرقام إلى واتساب" },
  "Il expire dans 10 minutes.": { en: "It expires in 10 minutes.", ar: "تنتهي صلاحيته خلال 10 دقائق." },
  "Code reçu": { en: "Code received", ar: "الرمز المستلم" },
  "Changer mon mot de passe": { en: "Change my password", ar: "تغيير كلمة المرور" },
  "Recommencer": { en: "Start over", ar: "إعادة المحاولة" },
  "Mot de passe modifié": { en: "Password changed", ar: "تم تغيير كلمة المرور" },
  "Vous pouvez maintenant vous connecter.": { en: "You can now sign in.", ar: "يمكنك الآن تسجيل الدخول." },
  "Patientez…": { en: "Please wait…", ar: "يرجى الانتظار…" },
  "Envoi…": { en: "Sending…", ar: "جارٍ الإرسال…" },
  "Retour": { en: "Back", ar: "رجوع" },
  "Enregistrer": { en: "Save", ar: "حفظ" },
  "Envoyer": { en: "Send", ar: "إرسال" },
  "Suivre": { en: "Track", ar: "تتبع" },
  "Recherche en cours…": { en: "Searching…", ar: "جارٍ البحث…" },
  "Identifiant": { en: "Username", ar: "اسم المستخدم" },
  "Identifiant *": { en: "Username *", ar: "اسم المستخدم *" },
  "Mot de passe": { en: "Password", ar: "كلمة المرور" },
  "Mot de passe *": { en: "Password *", ar: "كلمة المرور *" },
  "Nouveau mot de passe": { en: "New password", ar: "كلمة المرور الجديدة" },
  "Nom *": { en: "Last name *", ar: "اللقب *" },
  "Prénom *": { en: "First name *", ar: "الاسم *" },
  "Téléphone": { en: "Phone", ar: "الهاتف" },
  "Téléphone *": { en: "Phone *", ar: "الهاتف *" },
  "Téléphone associé au compte": { en: "Phone linked to the account", ar: "الهاتف المرتبط بالحساب" },
  "E-mail": { en: "Email", ar: "البريد الإلكتروني" },
  "E-mail (optionnel)": { en: "Email (optional)", ar: "البريد الإلكتروني (اختياري)" },
  "Adresse": { en: "Address", ar: "العنوان" },
  "Adresse (optionnel)": { en: "Address (optional)", ar: "العنوان (اختياري)" },
  "Devise": { en: "Currency", ar: "العملة" },
  "Mon profil": { en: "My profile", ar: "ملفي الشخصي" },
  "Enregistré": { en: "Registered", ar: "مُسجَّل" },
  "En transit": { en: "In transit", ar: "في الطريق" },
  "Arrivé": { en: "Arrived", ar: "وصل" },
  "Disponible au retrait": { en: "Ready for pickup", ar: "جاهز للاستلام" },
  "Livré": { en: "Delivered", ar: "تم التوصيل" },
  "Annulé": { en: "Cancelled", ar: "ملغى" },
  "Refusé": { en: "Refused", ar: "مرفوض" },
  "Colis annulé": { en: "Parcel cancelled", ar: "شحنة ملغاة" },
  "Colis refusé par le destinataire": { en: "Parcel refused by the recipient", ar: "رفض المستلم الشحنة" },
  "Colis annoncé": { en: "Parcel announced", ar: "تم الإبلاغ عن الشحنة" },
  "Reçu à l’entrepôt": { en: "Received at warehouse", ar: "تم الاستلام في المخزن" },
  "Expédié": { en: "Shipped", ar: "تم الإرسال" },
  "Arrivé en Guinée": { en: "Arrived in Guinea", ar: "وصل إلى غينيا" },
  "Disponible pour retrait": { en: "Ready for pickup", ar: "جاهز للاستلام" },
  "Total colis": { en: "Total parcels", ar: "إجمالي الشحنات" },
  "Prochains départs": { en: "Next departures", ar: "الرحلات القادمة" },
  "Dépôt jusqu’au": { en: "Drop-off until", ar: "الإيداع حتى" },
  "Départ le": { en: "Departure on", ar: "المغادرة في" },
  "Dernier jour": { en: "Last day", ar: "آخر يوم" },
  "Aérien": { en: "Air", ar: "جوي" },
  "Maritime": { en: "Sea", ar: "بحري" },
  "Bonjour": { en: "Good morning", ar: "صباح الخير" },
  "Expéditeur": { en: "Sender", ar: "المُرسِل" },
  "Destinataire": { en: "Recipient", ar: "المُستلِم" },
  "Payé en totalité": { en: "Fully paid", ar: "مدفوع بالكامل" },
  "Partiellement payé": { en: "Partially paid", ar: "مدفوع جزئيًا" },
  "Non payé": { en: "Not paid", ar: "غير مدفوع" },
  "Bon après-midi": { en: "Good afternoon", ar: "مساء الخير" },
  "Bonsoir": { en: "Good evening", ar: "مساء الخير" },
  "envoi": { en: "shipment", ar: "إرسال" },
  "envois": { en: "shipments", ar: "إرساليات" },
  "de réduction fidélité": { en: "loyalty discount", ar: "خصم الولاء" },
  "avant": { en: "to reach", ar: "للوصول إلى" },
  "En attente": { en: "Pending", ar: "قيد الانتظار" },
  "Reçus à l’entrepôt": { en: "Received at warehouse", ar: "مستلمة في المخزن" },
  "Expédiés": { en: "Shipped", ar: "مُرسلة" },
  "Arrivés en Guinée": { en: "Arrived in Guinea", ar: "وصلت إلى غينيا" },
  "Livrés": { en: "Delivered", ar: "تم توصيلها" },
  "Poids total": { en: "Total weight", ar: "الوزن الإجمالي" },
  "Montant payé": { en: "Amount paid", ar: "المبلغ المدفوع" },
  "Reste à payer": { en: "Balance due", ar: "المبلغ المتبقي" },
  "Total payé (tous colis)": { en: "Total paid (all parcels)", ar: "الإجمالي المدفوع (كل الشحنات)" },
  "Tous": { en: "All", ar: "الكل" },
  "En cours": { en: "In progress", ar: "قيد المعالجة" },
  "Non payés": { en: "Unpaid", ar: "غير مدفوعة" },
  "Payé": { en: "Paid", ar: "مدفوع" },
  "N° DE SUIVI": { en: "TRACKING NUMBER", ar: "رقم التتبع" },
  "HISTORIQUE": { en: "HISTORY", ar: "السجل" },
  "Destination": { en: "Destination", ar: "الوجهة" },
  "Mode": { en: "Mode", ar: "الوسيلة" },
  "Poids": { en: "Weight", ar: "الوزن" },
  "Enregistré le": { en: "Registered on", ar: "تاريخ التسجيل" },
  "Aucun colis trouvé": { en: "No parcel found", ar: "لم يتم العثور على شحنة" },
  "Vérifiez le numéro de suivi et réessayez.": { en: "Check the tracking number and try again.", ar: "تحقق من رقم التتبع وحاول مرة أخرى." },
  "Suivez tous vos colis Ba-Diaby Express en un seul endroit.": { en: "Track all your Ba-Diaby Express parcels in one place.", ar: "تابع جميع شحناتك مع با-ديابي إكسبريس في مكان واحد." },
  "Retrouvez tous vos colis, leurs statuts et vos paiements en un coup d'œil.": { en: "See all your parcels, their status and your payments at a glance.", ar: "اطّلع على جميع شحناتك وحالتها ومدفوعاتك بنظرة واحدة." },
  "Pré-alerte colis": { en: "Parcel pre-alert", ar: "إشعار مسبق بشحنة" },
  "Pré-alerte de colis": { en: "Parcel pre-alert", ar: "إشعار مسبق بشحنة" },
  "Ajouter la pré-alerte": { en: "Add pre-alert", ar: "إضافة الإشعار المسبق" },
  "Aucune pré-alerte pour le moment.": { en: "No pre-alerts yet.", ar: "لا توجد إشعارات مسبقة بعد." },
  "Description (optionnel)": { en: "Description (optional)", ar: "الوصف (اختياري)" },
  "Nombre d’articles": { en: "Number of items", ar: "عدد القطع" },
  "Référence de la commande": { en: "Order reference", ar: "مرجع الطلب" },
  "Afficher les montants en": { en: "Show amounts in", ar: "عرض المبالغ بـ" },
  "Votre référence de commande": { en: "Your order reference", ar: "مرجع طلبك" },
  "Votre colis vous attend": { en: "Your parcel is waiting for you", ar: "طردك في انتظارك" },
  "Colis signalé perdu": { en: "Parcel reported lost", ar: "تم الإبلاغ عن فقدان الطرد" },
  "Colis signalé endommagé": { en: "Parcel reported damaged", ar: "تم الإبلاغ عن تلف الطرد" },
  "réglé": { en: "resolved", ar: "تمت التسوية" },
  "Notre équipe traite votre dossier et vous recontacte.": { en: "Our team is handling your case and will get back to you.", ar: "فريقنا يعالج ملفك وسيتواصل معك." },
  "J’ai payé": { en: "I have paid", ar: "لقد دفعت" },
  "Paiement déclaré, en attente de vérification": { en: "Payment declared, awaiting verification", ar: "تم الإبلاغ عن الدفع، بانتظار التحقق" },
  "Copier toute l’adresse": { en: "Copy the whole address", ar: "نسخ العنوان بالكامل" },
  "Adresse copiée": { en: "Address copied", ar: "تم نسخ العنوان" },
  "Aucun colis rattaché à votre compte pour le moment.": { en: "No parcel linked to your account yet.", ar: "لا يوجد طرد مرتبط بحسابك بعد." },
  "Pour recevoir vos achats en ligne, indiquez notre adresse de Paris comme adresse de livraison au moment de commander.": { en: "To receive your online purchases, enter our Paris address as the delivery address when you order.", ar: "لاستلام مشترياتك عبر الإنترنت، أدخل عنواننا في باريس كعنوان للتسليم عند الطلب." },
  "Voir l’adresse de livraison": { en: "See the delivery address", ar: "عرض عنوان التسليم" },
  "Vous n’avez pas encore commandé ? Utilisez notre adresse de livraison à Paris.": { en: "Haven’t ordered yet? Use our Paris delivery address.", ar: "لم تطلب بعد؟ استخدم عنوان التسليم الخاص بنا في باريس." },
  "Voir l’adresse": { en: "See the address", ar: "عرض العنوان" },
  "Paiement accepté": { en: "Accepted payment", ar: "طرق الدفع المقبولة" },
  "Comment commander": { en: "How to order", ar: "كيفية الطلب" },
  "Quand vous commandez sur Shein, Amazon ou tout autre site, indiquez notre adresse à Paris comme adresse de livraison.": { en: "When ordering on Shein, Amazon or any other site, enter our Paris address as the delivery address.", ar: "عند الطلب من شي إن أو أمازون أو أي موقع آخر، أدخل عنواننا في باريس كعنوان للتسليم." },
  "Recopiez chaque champ exactement comme ci-dessous.": { en: "Copy each field exactly as shown below.", ar: "انسخ كل حقل تمامًا كما هو موضح أدناه." },
  "PRÉNOM": { en: "FIRST NAME", ar: "الاسم الأول" },
  "NOM": { en: "LAST NAME", ar: "اسم العائلة" },
  "ADRESSE": { en: "ADDRESS", ar: "العنوان" },
  "CODE POSTAL ET VILLE": { en: "POSTCODE AND CITY", ar: "الرمز البريدي والمدينة" },
  "PAYS": { en: "COUNTRY", ar: "البلد" },
  "TÉLÉPHONE": { en: "PHONE", ar: "الهاتف" },
  "Copier": { en: "Copy", ar: "نسخ" },
  "Copié": { en: "Copied", ar: "تم النسخ" },
  "Pourquoi votre identifiant dans le champ Prénom ?": { en: "Why your username in the First name field?", ar: "لماذا اسم المستخدم في خانة الاسم الأول؟" },
  "C’est ce qui nous permet de reconnaître votre colis dès son arrivée à l’entrepôt. Sans lui, votre colis arrive anonyme parmi des dizaines d’autres et son traitement prend du retard.": { en: "It is what allows us to identify your parcel as soon as it reaches the warehouse. Without it, your parcel arrives unnamed among dozens of others and is delayed.", ar: "هذا ما يسمح لنا بالتعرف على طردك فور وصوله إلى المستودع. بدونه يصل طردك دون اسم بين عشرات الطرود ويتأخر." },
  "Après avoir commandé": { en: "After ordering", ar: "بعد الطلب" },
  "Déclarez votre commande ici, avec sa référence, depuis « Pré-alerte colis ». Cela nous permet de préparer votre expédition et de vous prévenir dès la réception.": { en: "Declare your order here with its reference, from “Parcel pre-alert”. This lets us prepare your shipment and notify you upon arrival.", ar: "سجّل طلبك هنا مع مرجعه من «الإشعار المسبق». هذا يتيح لنا تجهيز شحنتك وإبلاغك عند الاستلام." },
  "Merci pour votre confiance.": { en: "Thank you for your trust.", ar: "شكرًا لثقتكم." },
  "Vérifier une référence": { en: "Check a reference", ar: "التحقق من مرجع" },
  "Autre": { en: "Other", ar: "أخرى" },
  "Messages avec l’agence": { en: "Messages with the agency", ar: "الرسائل مع الوكالة" },
  "Aucun message pour le moment. Écrivez-nous ci-dessous.": { en: "No messages yet. Write to us below.", ar: "لا توجد رسائل بعد. اكتب لنا أدناه." },
  "Signaler un problème": { en: "Report an issue", ar: "الإبلاغ عن مشكلة" },
  "Envoyer le signalement": { en: "Send report", ar: "إرسال الإبلاغ" },
  "Ouvert": { en: "Open", ar: "مفتوح" },
  "Résolu": { en: "Resolved", ar: "تم الحل" },
  "Regrouper mes colis": { en: "Combine my parcels", ar: "تجميع شحناتي" },
  "Note pour l’agence (optionnel)": { en: "Note for the agency (optional)", ar: "ملاحظة للوكالة (اختياري)" },
  "Mes paiements": { en: "My payments", ar: "مدفوعاتي" },
  "Déclarer un paiement": { en: "Declare a payment", ar: "الإبلاغ عن دفعة" },
  "Envoyer ma déclaration": { en: "Send my declaration", ar: "إرسال إقراري" },
  "Mode de paiement": { en: "Payment method", ar: "طريقة الدفع" },
  "Orange Money": { en: "Orange Money", ar: "أورنج موني" },
  "MTN Mobile Money": { en: "MTN Mobile Money", ar: "إم تي إن موبايل موني" },
  "Aucun paiement enregistré pour le moment.": { en: "No payments recorded yet.", ar: "لا توجد مدفوعات مسجلة بعد." },
  "Indiquez le montant payé.": { en: "Enter the amount paid.", ar: "أدخل المبلغ المدفوع." },
  "Facture": { en: "Invoice", ar: "الفاتورة" },
  "Mon bordereau (PDF)": { en: "My manifest (PDF)", ar: "كشفي (PDF)" },
  "Photo du colis à l’entrepôt": { en: "Photo of the parcel at the warehouse", ar: "صورة الشحنة في المخزن" },
  "Identifiant ou mot de passe incorrect.": { en: "Incorrect username or password.", ar: "اسم المستخدم أو كلمة المرور غير صحيحة." },
  "Identifiant ou numéro de téléphone incorrect.": { en: "Incorrect username or phone number.", ar: "اسم المستخدم أو رقم الهاتف غير صحيح." },
  "Cet identifiant est déjà utilisé. Choisissez-en un autre.": { en: "This username is already taken. Please choose another.", ar: "اسم المستخدم هذا مُستخدم بالفعل. اختر اسمًا آخر." },
  "La soumission a été bloquée. Réessayez.": { en: "Submission was blocked. Please try again.", ar: "تم حجب الإرسال. حاول مرة أخرى." },
  "Colis": { en: "Parcels", ar: "الشحنات" },
};
const CLIENT_LANGS = [
  { code: "fr", label: "Français" },
  { code: "en", label: "English" },
  { code: "ar", label: "العربية" },
];
/**
 * Langue client active, au niveau module. Une seule surface client est montée à la fois, ce qui
 * permet aux fenêtres modales enfants d’appeler tcx() sans qu’on ait à faire descendre la
 * propriété "lang" à travers huit composants. Mise à jour par useClientLang().
 */
let CLIENT_LANG_ACTIVE = "fr";
/** Comme tc(), mais utilise la langue client active — pour les modales enfants. */
function tcx(texte) { return tc(texte, CLIENT_LANG_ACTIVE); }
/** Traduit une chaîne pour l’espace client. Repli silencieux sur le français. */
function tc(texte, lang) {
  if (!lang || lang === "fr") return texte;
  const e = CLIENT_I18N[texte];
  return (e && e[lang]) || texte;
}
/**
 * Langue choisie par le CLIENT (indépendante de celle du back-office). Devinée depuis le
 * navigateur à la première visite, puis mémorisée sur l’appareil.
 */
function langueClientInitiale() {
  try {
    const enregistre = window.localStorage.getItem("bde-langue-client");
    if (enregistre && CLIENT_LANGS.some((l) => l.code === enregistre)) return enregistre;
    const nav = (navigator.language || "fr").slice(0, 2).toLowerCase();
    if (nav === "en" || nav === "ar") return nav;
  } catch (e) { /* localStorage indisponible (navigation privée) : on reste en français */ }
  return "fr";
}
/**
 * Abonnés à la langue client. Quatre composants différents appellent useClientLang(), et chaque
 * appel crée son PROPRE état React : changer la langue dans l'un ne mettait pas les autres à
 * jour. Résultat, le sélecteur traduisait l'écran de connexion mais pas l'en-tête de l'espace
 * client. On tient donc une liste des instances pour les notifier toutes ensemble.
 */
const ABONNES_LANGUE = new Set();

function useClientLang() {
  // La langue est lue AVANT le premier affichage (initialiseur paresseux de useState) et non
  // dans un useEffect, sinon la page s'affiche brièvement en français avant de basculer.
  const [lang, setLang] = useState(langueClientInitiale);
  useEffect(() => {
    ABONNES_LANGUE.add(setLang);
    return () => { ABONNES_LANGUE.delete(setLang); };
  }, []);
  CLIENT_LANG_ACTIVE = lang;
  function choisir(l) {
    CLIENT_LANG_ACTIVE = l;
    try { window.localStorage.setItem("bde-langue-client", l); } catch (e) {}
    ABONNES_LANGUE.forEach((maj) => maj(l));
  }
  return [lang, choisir];
}
/**
 * Sélecteur de langue des surfaces clients.
 *
 * Un menu déroulant plutôt que trois boutons côte à côte : sur téléphone, FR / EN / AR occupaient
 * une ligne entière alors qu'un seul choix est actif à la fois. Le menu tient dans la largeur d'un
 * bouton et affiche le nom complet de la langue, plus clair qu'un code à deux lettres.
 */
function ClientLangSwitch({ lang, onChange }) {
  const actuelle = CLIENT_LANGS.find((l) => l.code === lang) || CLIENT_LANGS[0];
  return (
    <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
      <Globe size={13} color="var(--muted)" style={{ position: "absolute", insetInlineStart: 9, pointerEvents: "none" }} />
      <select
        value={lang}
        onChange={(e) => onChange(e.target.value)}
        aria-label={`Langue : ${actuelle.label}`}
        style={{
          minHeight: 34, padding: "6px 10px 6px 27px", borderRadius: 8, cursor: "pointer",
          fontSize: 12.5, fontWeight: 600, border: "1px solid var(--border)",
          background: "var(--surface)", color: "var(--text)", appearance: "none",
        }}>
        {CLIENT_LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
      </select>
    </div>
  );
}

function PublicTrackingPage({ data, loading }) {
  const [lang, setLang] = useClientLang();
  const T = (x) => tc(x, lang);
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const [code, setCode] = useState(params?.get("code") || "");
  const [searched, setSearched] = useState(!!params?.get("code"));
  const colis = data && searched ? data.colis.find((c) => c.tracking.toUpperCase() === code.trim().toUpperCase()) : null;
  const notFound = searched && !loading && data && !colis;

  function rechercher(e) {
    e?.preventDefault();
    if (!code.trim()) return;
    setSearched(true);
    const url = new URL(window.location.href);
    url.searchParams.set("suivi", "1"); url.searchParams.set("code", code.trim());
    window.history.replaceState({}, "", url);
  }

  // Le destinataire réel (colis.destinatairePays) prime sur le pays de route (colis.pays) : pour
  // un colis import, colis.pays est le pays d'origine à l'étranger, pas la destination affichée
  // au client, qui est toujours la Guinée.
  const destPaysCode = colis ? (colis.destinatairePays || colis.pays) : null;
  const dest = destPaysCode ? COUNTRIES.find((c) => c.code === destPaysCode) : null;
  const publicSteps = ["Enregistré", "En transit", "Arrivé", "Disponible au retrait", "Livré"];
  const curIdx = colis ? Math.max(publicSteps.indexOf(colis.status), 0) : 0;
  // La terminologie "espace client" (Reçu à l’entrepôt, Arrivé en Guinée...) ne concerne que
  // les colis liés à un compte Espace Client (achats Shein/Amazon/etc. suivis via pré-alerte).
  // Un colis "ordinaire" envoyé par un expéditeur quelconque, sans compte client, garde le
  // vocabulaire interne classique (Enregistré, En transit, Arrivé...).
  const estAchatEnLigne = colis ? !!colis.clientAccountId : false;

  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"} style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 16px" }}>
      <div style={{ width: "100%", maxWidth: 560, display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <ClientLangSwitch lang={lang} onChange={setLang} />
      </div>
      <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 24, color: "var(--text)", marginBottom: 4 }}>
        BA-DIABY <span style={{ color: "var(--danger-fg)" }}>EXPRESS</span>
      </div>
      <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 28 }}>{T("Suivi de colis")}</div>

      <form onSubmit={rechercher} style={{ display: "flex", gap: 8, width: "100%", maxWidth: 420, marginBottom: 24 }}>
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Numéro de suivi (ex : BDE123456)" style={{ ...inputStyle, flex: 1, fontSize: 15, padding: "12px 14px" }} />
        <button type="submit" style={{ background: "var(--brand-solid)", color: "#fff", border: "none", borderRadius: 8, padding: "0 20px", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>{T("Suivre")}</button>
      </form>

      {loading && searched && <div style={{ color: "var(--muted)", fontSize: 13 }}>{T("Recherche en cours…")}</div>}

      {notFound && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20, width: "100%", maxWidth: 420, textAlign: "center" }}>
          <div style={{ fontSize: 13.5, color: "var(--text)", fontWeight: 600 }}>{T("Aucun colis trouvé")}</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{T("Vérifiez le numéro de suivi et réessayez.")}</div>
        </div>
      )}

      {colis && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 24, width: "100%", maxWidth: 480 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18, flexWrap: "wrap", gap: 8 }}>
            <div>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>{T("N° DE SUIVI")}</div>
              <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 19, fontWeight: 700, color: "var(--text)" }}>{colis.tracking}</div>
            </div>
            <span style={{ background: STATUS_STYLE[colis.status]?.bg || "var(--surface2)", color: STATUS_STYLE[colis.status]?.fg || "var(--text)", padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>{estAchatEnLigne ? clientStatusLabel(colis.status) : colis.status}</span>
          </div>

          {colis.status !== "Annulé" && colis.status !== "Refusé" && (
            estAchatEnLigne ? <ClientTimeline status={colis.status} /> : (
              <div style={{ display: "flex", alignItems: "center", marginBottom: 22 }}>
                {publicSteps.map((s, i) => (
                  <React.Fragment key={s}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flex: i === 0 || i === publicSteps.length - 1 ? "0 0 auto" : 1 }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: i <= curIdx ? "#3ECB84" : "var(--border)" }} />
                      <div style={{ fontSize: 8.5, color: i <= curIdx ? "var(--text)" : "var(--muted)", whiteSpace: "nowrap" }}>{s}</div>
                    </div>
                    {i < publicSteps.length - 1 && <div style={{ height: 2, flex: 1, background: i < curIdx ? "#3ECB84" : "var(--border)", marginBottom: 12 }} />}
                  </React.Fragment>
                ))}
              </div>
            )
          )}

          {/*
            Expéditeur et destinataire : la personne qui scanne l'étiquette doit reconnaître son
            colis d'un coup d'œil, surtout quand plusieurs colis se ressemblent à l'entrepôt.
          */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 14 }}>
            <Info label={T("Expéditeur")} value={colis.expediteur || "—"} />
            <Info label={T("Destinataire")} value={colis.destinataire || "—"} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 18 }}>
            <Info label="Destination" value={`${FLAGS[destPaysCode] || ""} ${dest?.name || "—"}`} />
            <Info label="Mode" value={colis.mode === "air" ? "Aérien" : "Maritime"} />
            <Info label="Poids" value={`${colis.poids} kg`} />
            <Info label="Enregistré le" value={new Date(colis.createdAt).toLocaleDateString("fr-FR")} />
          </div>

          {/*
            État du paiement. Le reste dû est annoncé en GNF — c'est ce que le client remettra à
            l'agence. Page publique : on annonce ce qui reste à régler, jamais l'historique des
            versements ni le détail des prix.
          */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap",
                        background: colis.reste <= 0.005 ? "var(--ok-bg)" : colis.paye > 0 ? "var(--warn-bg)" : "var(--danger-bg)",
                        border: "1px solid " + (colis.reste <= 0.005 ? "var(--ok-border)" : colis.paye > 0 ? "var(--warn-border)" : "var(--danger-border)"),
                        borderRadius: 10, padding: "11px 14px", marginBottom: 18 }}>
            <span style={{ fontSize: 12.5, fontWeight: 700,
                           color: colis.reste <= 0.005 ? "var(--ok-fg)" : colis.paye > 0 ? "var(--warn-fg)" : "var(--danger-fg)" }}>
              {colis.reste <= 0.005 ? T("Payé en totalité") : colis.paye > 0 ? T("Partiellement payé") : T("Non payé")}
            </span>
            {colis.reste > 0.005 && (
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
                {T("Reste à payer")} : {fmtGNF(colis.reste * (LIVE_RATES.GNF || CURRENCIES.GNF))}
              </span>
            )}
          </div>

          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
            <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8 }}>{T("HISTORIQUE")}</div>
            {colis.historique.map((h, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "var(--text)", marginBottom: 6 }}>
                <span>{estAchatEnLigne ? clientStatusLabel(h.status) : h.status}</span>
                <span style={{ color: "var(--muted)" }}>{new Date(h.date).toLocaleDateString("fr-FR")}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 32 }}>{T("Ba-Diaby Express — Transport de colis Conakry - Monde")}</div>
    </div>
  );
}

/**
 * Espace Client — accessible sans compte staff, via "?client=1". Un client identifié par son
 * numéro de téléphone (celui utilisé comme destinataire lors de l’enregistrement de ses colis)
 * voit TOUS ses colis d’un coup : statuts, paiements, factures — au lieu de devoir suivre
 * chaque colis un par un avec un numéro de suivi. Pensé pour les clients réguliers qui
 * reçoivent plusieurs colis par semaine et perdent facilement le fil des paiements.
 *
 * Identification par numéro de téléphone uniquement (pas de mot de passe dédié) : pratique et
 * sans friction, mais quelqu’un connaissant le numéro d’un client pourrait voir ses données.
 * Acceptable pour du suivi de colis, mais à garder en tête.
 */
/**
 * Protection anti-spam légère pour les formulaires publics (inscription client, pré-alerte),
 * sans dépendre d’un service externe (pas de clé reCAPTCHA à configurer) :
 *  1. Champ "piège" invisible pour un humain mais que les robots remplissent automatiquement.
 *  2. Délai minimum entre l’affichage du formulaire et l’envoi — les robots soumettent
 *     quasi instantanément, un humain met toujours au moins quelques secondes.
 * Utilisation : const { honeypotField, isSpam } = useAntiSpam(); puis vérifier isSpam() avant
 * d’enregistrer, et inclure {honeypotField} dans le formulaire.
 */
function useAntiSpam() {
  const [piege, setPiege] = useState("");
  const montageRef = useRef(Date.now());
  function isSpam() {
    if (piege) return true; // le champ piège a été rempli : c’est un robot
    if (Date.now() - montageRef.current < 1500) return true; // soumis trop vite pour être humain
    return false;
  }
  const honeypotField = (
    <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", top: "-9999px", opacity: 0, height: 0, overflow: "hidden" }}>
      <label htmlFor="site_internet">Ne pas remplir ce champ</label>
      <input id="site_internet" tabIndex={-1} autoComplete="off" value={piege} onChange={(e) => setPiege(e.target.value)} />
    </div>
  );
  return { honeypotField, isSpam };
}

function ClientRegisterForm({ data, persist, onRegistered, onCancel }) {
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [identifiant, setIdentifiant] = useState("");
  const [motdepasse, setMotdepasse] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [telephone, setTelephone] = useState("");
  const [adresse, setAdresse] = useState("");
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const { honeypotField, isSpam } = useAntiSpam();

  async function submit(e) {
    e.preventDefault();
    setErr("");
    if (isSpam()) { setErr("La soumission a été bloquée. Réessayez."); return; }
    if (!nom || !prenom || !identifiant || !motdepasse || !telephone) { setErr("Merci de renseigner au moins le nom, prénom, identifiant, mot de passe et téléphone."); return; }
    if ((data.clientAccounts || []).some((c) => c.identifiant.toLowerCase() === identifiant.trim().toLowerCase())) { setErr("Cet identifiant est déjà utilisé. Choisissez-en un autre."); return; }
    setLoading(true);
    try {
      const identifiants = await creerIdentifiantsMotDePasse(motdepasse);
      const account = {
        id: `cli${Date.now()}`, nom, prenom, identifiant: identifiant.trim(), ...identifiants,
        telephone, adresse, email, createdAt: new Date().toISOString(),
      };
      persist({ ...data, clientAccounts: [...(data.clientAccounts || []), account] });
      onRegistered(account);
    } catch (ex) {
      console.error("Échec de la création du compte :", ex);
      setErr("Une erreur technique est survenue. Réessayez, ou contactez l’agence si le problème persiste.");
    }
    setLoading(false);
  }

  return (
    <div style={{ width: "100%", maxWidth: 420, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 24 }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>{tcx("Créer mon compte client")}</div>
      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 18 }}>{tcx("Suivez tous vos colis Ba-Diaby Express en un seul endroit.")}</div>
      <form onSubmit={submit}>
        {honeypotField}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label={tcx("Prénom *")}><input value={prenom} onChange={(e) => setPrenom(e.target.value)} style={inputStyle} /></Field>
          <Field label={tcx("Nom *")}><input value={nom} onChange={(e) => setNom(e.target.value)} style={inputStyle} /></Field>
        </div>
        <Field label={tcx("Identifiant *")}><input value={identifiant} onChange={(e) => setIdentifiant(e.target.value)} style={inputStyle} placeholder="ex : fatoumata.diallo" /></Field>
        <Field label={tcx("Mot de passe *")}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type={showPw ? "text" : "password"} autoComplete="new-password" value={motdepasse} onChange={(e) => setMotdepasse(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
            <button type="button" onClick={() => setShowPw((s) => !s)} style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, width: 34, height: 34, cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0 }}>
              {showPw ? <EyeOff size={14} color="var(--muted)" /> : <Eye size={14} color="var(--muted)" />}
            </button>
          </div>
        </Field>
        <Field label={tcx("Téléphone *")}><PhoneInput value={telephone} onChange={setTelephone} /></Field>
        <Field label={tcx("Adresse (optionnel)")}><input value={adresse} onChange={(e) => setAdresse(e.target.value)} style={inputStyle} /></Field>
        <Field label={tcx("E-mail (optionnel)")}><input value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} /></Field>
        {err && <div style={{ color: "var(--danger-fg)", fontSize: 12.5, marginBottom: 10 }}>{err}</div>}
        <button type="submit" disabled={loading} style={{ width: "100%", marginTop: 4, background: "var(--brand-solid)", color: "#fff", border: "none", borderRadius: 8, padding: "11px 0", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>{loading ? "Création…" : "Créer mon compte"}</button>
        <button type="button" onClick={onCancel} style={{ width: "100%", marginTop: 8, background: "none", border: "none", color: "var(--muted)", fontSize: 12.5, cursor: "pointer" }}>{tcx("J’ai déjà un compte — me connecter")}</button>
        <div style={{ fontSize: 10.5, color: "var(--muted)", textAlign: "center", marginTop: 10 }}>
          En créant un compte, vous acceptez nos <a href="?cgu=1" style={{ color: "var(--muted)" }}>conditions générales et notre politique de confidentialité</a>.
        </div>
      </form>
    </div>
  );
}

/**
 * Espace Client — accessible sans compte staff, via "?client=1". Chaque client dispose d’un
 * vrai compte sécurisé (identifiant + mot de passe, même hachage salé que le personnel).
 * Les agents rattachent chaque colis reçu au bon compte client en recherchant son nom
 * (celui écrit sur le colis) dans la fiche de réception — voir ClientAccountLinker dans
 * le formulaire de création de colis.
 */
/**
 * Récupération de mot de passe client — sans envoi d’e-mail (aucun service d’envoi configuré),
 * la vérification se fait en confirmant l’identifiant ET le numéro de téléphone du compte.
 * Moins robuste qu’un vrai lien de réinitialisation par e-mail, mais reste self-service.
 */
function ClientResetPasswordForm({ data, persist, onDone, onCancel }) {
  /*
   * Réinitialisation en deux temps, avec un code envoyé sur WhatsApp.
   *
   * L'ancienne version se contentait de l'identifiant et du numéro de téléphone pour autoriser
   * un changement de mot de passe. Or ce numéro figure sur les étiquettes, les factures et les
   * bordereaux : toute personne ayant vu un colis pouvait prendre le contrôle du compte.
   *
   * Désormais un code à 6 chiffres est envoyé sur le WhatsApp du titulaire — seul celui qui a le
   * téléphone en main peut aller au bout. Le code expire au bout de 10 minutes et le nombre
   * d'essais est limité, pour qu'il ne puisse pas être deviné.
   *
   * Si l'envoi automatique n'est pas disponible, le code n'est jamais affiché à l'écran : ce
   * serait contourner toute la protection. Le client est invité à contacter l'agence, qui peut
   * réinitialiser depuis le Centre clients après avoir vérifié son identité.
   */
  const [etape, setEtape] = useState("demande");   // demande → code → succes
  const [identifiant, setIdentifiant] = useState("");
  const [code, setCode] = useState("");
  const [motdepasse, setMotdepasse] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [compte, setCompte] = useState(null);
  const [codeAttendu, setCodeAttendu] = useState(null);
  const [expire, setExpire] = useState(0);
  const [essais, setEssais] = useState(0);
  const [masque, setMasque] = useState("");

  /** Affiche 62•••••99 : assez pour se reconnaître, pas assez pour deviner le numéro. */
  function masquerNumero(tel) {
    const n = String(tel || "").replace(/\D/g, "");
    if (n.length < 4) return "votre numéro";
    return n.slice(0, 2) + "•".repeat(Math.max(n.length - 4, 3)) + n.slice(-2);
  }

  async function envoyerCode(e) {
    e.preventDefault();
    setErr("");
    const acc = (data.clientAccounts || []).find((c) => c.identifiant.toLowerCase() === identifiant.trim().toLowerCase());
    // Message identique que le compte existe ou non : sinon on révélerait quels identifiants
    // sont valides, ce qui aiderait quelqu'un à en chercher.
    if (!acc || !acc.telephone) {
      setErr("Si ce compte existe, un code vient d’être envoyé sur son WhatsApp.");
      return;
    }
    setLoading(true);
    const genere = genOtp();
    const { envoye } = await envoyerWhatsApp(acc.telephone,
      `Ba-Diaby Express — votre code de réinitialisation est ${genere}. Il expire dans 10 minutes. Si vous n’avez rien demandé, ignorez ce message.`);
    setLoading(false);
    if (!envoye) {
      setErr("Nous ne parvenons pas à envoyer le code pour le moment. Contactez notre agence, qui pourra réinitialiser votre mot de passe.");
      return;
    }
    setCompte(acc);
    setCodeAttendu(genere);
    setExpire(Date.now() + 10 * 60000);
    setMasque(masquerNumero(acc.telephone));
    setEssais(0);
    setEtape("code");
  }

  async function valider(e) {
    e.preventDefault();
    setErr("");
    if (Date.now() > expire) { setErr("Ce code a expiré. Recommencez la demande."); setEtape("demande"); return; }
    if (essais >= 5) { setErr("Trop d’essais. Recommencez la demande."); setEtape("demande"); return; }
    if (code.trim() !== codeAttendu) { setEssais((n) => n + 1); setErr("Code incorrect."); return; }
    if (!motdepasse || motdepasse.length < 8) { setErr("Choisissez un mot de passe d’au moins 8 caractères."); return; }
    setLoading(true);
    const identifiants = await creerIdentifiantsMotDePasse(motdepasse);
    persist({ ...data, clientAccounts: (data.clientAccounts || []).map((c) => (c.id === compte.id ? { ...c, ...identifiants } : c)) });
    setLoading(false);
    setEtape("succes");
    setTimeout(onDone, 1400);
  }

  const cadre = { width: "100%", maxWidth: 380, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 22 };

  if (etape === "succes") {
    return (
      <div style={{ ...cadre, textAlign: "center" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ok-fg)", marginBottom: 6 }}>✓ {tcx("Mot de passe modifié")}</div>
        <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{tcx("Vous pouvez maintenant vous connecter.")}</div>
      </div>
    );
  }

  if (etape === "code") {
    return (
      <form onSubmit={valider} style={cadre}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>{tcx("Code de vérification")}</div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16 }}>
          {tcx("Nous avons envoyé un code à 6 chiffres sur le WhatsApp du")} {masque}. {tcx("Il expire dans 10 minutes.")}
        </div>
        <Field label={tcx("Code reçu")}>
          <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric" autoFocus placeholder="000000"
            style={{ ...inputStyle, letterSpacing: 6, fontSize: 18, fontWeight: 700, textAlign: "center" }} />
        </Field>
        <Field label={tcx("Nouveau mot de passe")}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type={showPw ? "text" : "password"} value={motdepasse} onChange={(e) => setMotdepasse(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
            <button type="button" onClick={() => setShowPw((s) => !s)} style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 10px", cursor: "pointer" }}>
              {showPw ? <EyeOff size={14} color="var(--muted)" /> : <Eye size={14} color="var(--muted)" />}
            </button>
          </div>
        </Field>
        {err && <div style={{ color: "var(--danger-fg)", fontSize: 12.5, marginBottom: 10 }}>{err}</div>}
        <button type="submit" disabled={loading} style={{ width: "100%", marginTop: 4, background: "var(--brand-solid)", color: "#fff", border: "none", borderRadius: 8, padding: "11px 0", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>
          {loading ? tcx("Patientez…") : tcx("Changer mon mot de passe")}
        </button>
        <button type="button" onClick={() => { setEtape("demande"); setErr(""); setCode(""); }} style={{ width: "100%", marginTop: 8, background: "none", border: "none", color: "var(--muted)", fontSize: 12.5, cursor: "pointer" }}>
          {tcx("Recommencer")}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={envoyerCode} style={cadre}>
      <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>{tcx("Mot de passe oublié")}</div>
      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16 }}>
        {tcx("Saisissez votre identifiant : nous enverrons un code de vérification sur le WhatsApp associé à votre compte.")}
      </div>
      <Field label={tcx("Identifiant")}>
        <input value={identifiant} onChange={(e) => setIdentifiant(e.target.value)} autoFocus style={inputStyle} />
      </Field>
      {err && <div style={{ color: "var(--warn-fg)", fontSize: 12.5, marginBottom: 10 }}>{err}</div>}
      <button type="submit" disabled={loading || !identifiant.trim()} style={{ width: "100%", marginTop: 4, background: "var(--brand-solid)", color: "#fff", border: "none", borderRadius: 8, padding: "11px 0", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>
        {loading ? tcx("Envoi…") : tcx("Recevoir le code")}
      </button>
      <button type="button" onClick={onCancel} style={{ width: "100%", marginTop: 8, background: "none", border: "none", color: "var(--muted)", fontSize: 12.5, cursor: "pointer" }}>
        {tcx("Retour")}
      </button>
    </form>
  );
}

/** Modale pour qu’un client modifie ses propres coordonnées (téléphone, adresse, e-mail). */
function ClientProfilModal({ compte, onSave, onClose }) {
  const [telephone, setTelephone] = useState(compte.telephone || "");
  const [adresse, setAdresse] = useState(compte.adresse || "");
  const [email, setEmail] = useState(compte.email || "");
  const [saved, setSaved] = useState(false);

  function submit(e) {
    e.preventDefault();
    onSave({ telephone, adresse, email });
    setSaved(true);
    setTimeout(onClose, 900);
  }

  return (
    <Modal onClose={onClose} title={tcx("Mon profil")}>
      <form onSubmit={submit}>
        <Field label={tcx("Téléphone")}><PhoneInput value={telephone} onChange={setTelephone} /></Field>
        <Field label={tcx("Adresse")}><input value={adresse} onChange={(e) => setAdresse(e.target.value)} style={inputStyle} /></Field>
        <Field label={tcx("E-mail")}><input value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} /></Field>
        {saved && <div style={{ color: "var(--ok-fg)", fontSize: 12.5, marginBottom: 10 }}>✓ Profil mis à jour</div>}
        <button type="submit" style={{ width: "100%", background: "#3ECB84", color: "#0A2647", border: "none", borderRadius: 8, padding: "11px 0", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>{tcx("Enregistrer")}</button>
      </form>
    </Modal>
  );
}

/**
 * Modale pré-alerte : le client indique à l’avance un colis qu’il attend (ex : numéro de suivi
 * Shein), pour aider les agents à savoir à qui rattacher le colis dès sa réception, plutôt que
 * de chercher le nom au moment où il arrive.
 */
/** Fil de discussion simple entre le client et l’administration (pas lié à un colis précis,
 * contrairement aux signalements). Marque les messages du staff comme lus à l’ouverture. */
function ClientMessagesModal({ compte, onSend, onClose }) {
  const [texte, setTexte] = useState("");
  const messages = compte.messages || [];
  return (
    <Modal onClose={onClose} title="Messages avec l’agence">
      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 360, overflowY: "auto", marginBottom: 14, padding: "4px 2px" }}>
        {messages.length === 0 ? (
          <div style={{ fontSize: 12.5, color: "var(--muted)", textAlign: "center", padding: "20px 0" }}>{tcx("Aucun message pour le moment. Écrivez-nous ci-dessous.")}</div>
        ) : messages.map((m) => (
          <div key={m.id} style={{ alignSelf: m.expediteur === "client" ? "flex-end" : "flex-start", maxWidth: "80%", background: m.expediteur === "client" ? "var(--brand-solid)" : "var(--surface2)", color: m.expediteur === "client" ? "#fff" : "var(--text)", borderRadius: 12, padding: "8px 12px" }}>
            <div style={{ fontSize: 12.5 }}>{m.texte}</div>
            <div style={{ fontSize: 9.5, opacity: 0.75, marginTop: 3 }}>{new Date(m.date).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input value={texte} onChange={(e) => setTexte(e.target.value)} placeholder="Écrire un message..." style={{ ...inputStyle, flex: 1, marginBottom: 0 }} onKeyDown={(e) => { if (e.key === "Enter" && texte.trim()) { onSend(texte.trim()); setTexte(""); } }} />
        <button onClick={() => { if (texte.trim()) { onSend(texte.trim()); setTexte(""); } }} style={{ background: "var(--brand-solid)", color: "#fff", border: "none", borderRadius: 8, padding: "0 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{tcx("Envoyer")}</button>
      </div>
    </Modal>
  );
}

/** Le client demande de regrouper plusieurs colis reçus à l’entrepôt en un seul envoi, pour
 * réduire les frais. Ceci crée une DEMANDE que l’agence doit valider manuellement — le
 * regroupement physique reste une opération faite par l’agence, pas automatisée. */
function RegroupementModal({ colisEligibles, onDemander, onClose }) {
  const [selection, setSelection] = useState([]);
  const [note, setNote] = useState("");
  function toggle(tracking) {
    setSelection((s) => (s.includes(tracking) ? s.filter((t) => t !== tracking) : [...s, tracking]));
  }
  return (
    <Modal onClose={onClose} title="Regrouper mes colis" wide>
      <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 14 }}>Sélectionnez les colis reçus à l’entrepôt que vous souhaitez regrouper en un seul envoi. L’agence validera la demande avant expédition.</div>
      {colisEligibles.length < 2 ? (
        <div style={{ fontSize: 12.5, color: "var(--muted)" }}>Il vous faut au moins 2 colis "Reçus à l’entrepôt" pour demander un regroupement.</div>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
            {colisEligibles.map((c) => (
              <label key={c.tracking} style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--surface2)", borderRadius: 8, padding: "9px 12px", cursor: "pointer" }}>
                <input type="checkbox" checked={selection.includes(c.tracking)} onChange={() => toggle(c.tracking)} />
                <div style={{ fontSize: 12.5, color: "var(--text)" }}>{c.tracking} — {c.poids} kg{c.provenance ? ` · ${c.provenance}` : ""}</div>
              </label>
            ))}
          </div>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={tcx("Note pour l’agence (optionnel)")} style={{ ...inputStyle, marginBottom: 14 }} />
          <button onClick={() => selection.length >= 2 && onDemander(selection, note.trim())} disabled={selection.length < 2} style={{ width: "100%", background: selection.length >= 2 ? "var(--brand-solid)" : "var(--surface2)", color: "#fff", border: "none", borderRadius: 8, padding: "11px 0", fontSize: 14, fontWeight: 700, cursor: selection.length >= 2 ? "pointer" : "default" }}>
            Demander le regroupement ({selection.length} colis)
          </button>
        </>
      )}
    </Modal>
  );
}

function SignalerProblemeModal({ colis, onSignaler, onClose }) {
  const [message, setMessage] = useState("");
  return (
    <Modal onClose={onClose} title="Signaler un problème">
      <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 14 }}>{tcx("Colis")}<strong style={{ color: "var(--text)" }}>{colis.tracking}</strong> — décrivez le problème rencontré, un agent vous répondra ici.</div>
      <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} placeholder="Ex : article manquant, colis endommagé, retard important..." style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit", marginBottom: 14 }} />
      <button onClick={() => { if (message.trim()) onSignaler(message.trim()); }} disabled={!message.trim()} style={{ width: "100%", background: message.trim() ? "var(--brand-solid)" : "var(--surface2)", color: "#fff", border: "none", borderRadius: 8, padding: "11px 0", fontSize: 14, fontWeight: 700, cursor: message.trim() ? "pointer" : "default" }}>{tcx("Envoyer le signalement")}</button>
    </Modal>
  );
}

/**
 * Guide de commande affiché dans l'Espace Client.
 *
 * C'est le mode d'emploi que le client doit suivre au moment de commander sur Shein, Amazon ou
 * ailleurs : quelle adresse saisir, et surtout quoi mettre dans le champ « Prénom ». Cette
 * dernière consigne est la plus importante : c'est elle qui permet de reconnaître le
 * propriétaire d'un colis à son arrivée à l'entrepôt.
 *
 * Les coordonnées viennent de la base (Configuration → Agences), elles ne sont pas figées ici.
 * Chaque champ dispose d'un bouton de copie : sur téléphone, recopier une adresse à la main
 * dans un formulaire de commande est la principale source d'erreurs.
 */
function GuideCommandeModal({ compte, agence, onClose }) {
  const [copie, setCopie] = useState("");
  const adresse = agence?.adresse || "26 rue Saint Blaise, 75020 Paris";
  const telephone = agence?.telephone || "+33767562963";
  const morceaux = adresse.split(",").map((x) => x.trim());
  const rue = morceaux[0] || adresse;
  const cpVille = morceaux.slice(1).join(", ") || "75020 Paris";
  /*
   * Les sites marchands français attendent un numéro au format local (07 67 56 29 63) et
   * refusent souvent le format international. On affiche donc le format local, en gardant
   * l'international en second pour les sites étrangers.
   */
  const telLocal = telephone.startsWith("+33") ? "0" + telephone.slice(3) : telephone;
  const telLisible = telLocal.length === 10
    ? telLocal.replace(/(\d{2})(?=\d)/g, "$1 ").trim()
    : telLocal;
  const blocComplet = [compte?.identifiant || "", "Ba-Diaby Express", rue, cpVille, "France", telLisible].join("\n");

  function copier(valeur, cle) {
    try {
      navigator.clipboard.writeText(valeur);
      setCopie(cle);
      setTimeout(() => setCopie(""), 1800);
    } catch (e) { /* presse-papiers indisponible : le client peut sélectionner le texte */ }
  }

  const Ligne = ({ etiquette, valeur, cle, souligne }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "9px 0", borderTop: "1px solid var(--border)" }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 10.5, color: "var(--muted)", fontWeight: 700, letterSpacing: 0.3 }}>{etiquette}</div>
        <div style={{ fontSize: 13.5, color: souligne ? "var(--ok-fg)" : "var(--text)", fontWeight: souligne ? 700 : 600, wordBreak: "break-word" }}>{valeur}</div>
      </div>
      <button onClick={() => copier(valeur, cle)} style={{ flexShrink: 0, background: copie === cle ? "var(--ok-bg)" : "var(--surface2)", border: "1px solid " + (copie === cle ? "var(--ok-border)" : "var(--border)"), color: copie === cle ? "var(--ok-fg)" : "var(--muted)", borderRadius: 6, padding: "5px 11px", fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}>
        {copie === cle ? tcx("Copié") : tcx("Copier")}
      </button>
    </div>
  );

  return (
    <Modal onClose={onClose} title={tcx("Comment commander")} wide>
      <div style={{ fontSize: 13, color: "var(--text)", marginBottom: 6 }}>
        {tcx("Quand vous commandez sur Shein, Amazon ou tout autre site, indiquez notre adresse à Paris comme adresse de livraison.")}
      </div>
      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16 }}>
        {tcx("Recopiez chaque champ exactement comme ci-dessous.")}
      </div>

      <button onClick={() => copier(blocComplet, "tout")}
        style={{ width: "100%", marginBottom: 10, background: copie === "tout" ? "var(--ok-bg)" : "var(--brand-solid)",
                 border: "1px solid " + (copie === "tout" ? "var(--ok-border)" : "transparent"),
                 color: copie === "tout" ? "var(--ok-fg)" : "#fff", borderRadius: 8, padding: "11px 0",
                 fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>
        {copie === "tout" ? tcx("Adresse copiée") : tcx("Copier toute l’adresse")}
      </button>

      <div style={{ background: "var(--surface2)", borderRadius: 12, padding: "4px 14px 12px" }}>
        <Ligne etiquette={tcx("PRÉNOM")} valeur={compte?.identifiant || ""} cle="prenom" souligne />
        <Ligne etiquette={tcx("NOM")} valeur="Ba-Diaby Express" cle="nom" />
        <Ligne etiquette={tcx("ADRESSE")} valeur={rue} cle="rue" />
        <Ligne etiquette={tcx("CODE POSTAL ET VILLE")} valeur={cpVille} cle="cp" />
        <Ligne etiquette={tcx("PAYS")} valeur="France" cle="pays" />
        <Ligne etiquette={tcx("TÉLÉPHONE")} valeur={telLisible} cle="tel" />
      </div>

      <div style={{ background: "var(--info-bg)", border: "1px solid var(--info-border)", borderRadius: 12, padding: "12px 14px", marginTop: 16 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--info-fg)", marginBottom: 4 }}>
          {tcx("Pourquoi votre identifiant dans le champ Prénom ?")}
        </div>
        <div style={{ fontSize: 12, color: "var(--text)", lineHeight: 1.5 }}>
          {tcx("C’est ce qui nous permet de reconnaître votre colis dès son arrivée à l’entrepôt. Sans lui, votre colis arrive anonyme parmi des dizaines d’autres et son traitement prend du retard.")}
        </div>
      </div>

      <div style={{ background: "var(--warn-bg)", border: "1px solid var(--warn-border)", borderRadius: 12, padding: "12px 14px", marginTop: 12 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--warn-fg)", marginBottom: 4 }}>
          {tcx("Après avoir commandé")}
        </div>
        <div style={{ fontSize: 12, color: "var(--text)", lineHeight: 1.5 }}>
          {tcx("Déclarez votre commande ici, avec sa référence, depuis « Pré-alerte colis ». Cela nous permet de préparer votre expédition et de vous prévenir dès la réception.")}
        </div>
      </div>

      <div style={{ fontSize: 12, color: "var(--muted)", textAlign: "center", marginTop: 16 }}>
        {tcx("Merci pour votre confiance.")}
      </div>
    </Modal>
  );
}

function ClientPreAlerteModal({ preAlertes, onAdd, onRemove, onClose, onVoirGuide }) {
  const [trackingExterne, setTrackingExterne] = useState("");
  const [provenance, setProvenance] = useState("Shein");
  const [description, setDescription] = useState("");
  const [nbArticles, setNbArticles] = useState("");
  const [valeurCommande, setValeurCommande] = useState("");
  const { honeypotField, isSpam } = useAntiSpam();

  function submit(e) {
    e.preventDefault();
    if (isSpam()) return;
    if (!trackingExterne.trim()) return;
    onAdd(trackingExterne.trim(), description.trim(), provenance, {
      nbArticles: nbArticles ? Number(nbArticles) : null,
      valeurCommande: valeurCommande ? Number(valeurCommande) : null,
    });
    setTrackingExterne(""); setDescription(""); setNbArticles(""); setValeurCommande("");
  }

  return (
    <Modal onClose={onClose} title="Pré-alerte de colis" wide saisieEnCours={!!trackingExterne || !!description}>
      {onVoirGuide && (
        <button type="button" onClick={onVoirGuide}
          style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
                   background: "var(--info-bg)", border: "1px solid var(--info-border)", borderRadius: 12,
                   padding: "10px 14px", marginBottom: 14, cursor: "pointer", textAlign: "start" }}>
          <span style={{ fontSize: 12, color: "var(--text)" }}>
            {tcx("Vous n’avez pas encore commandé ? Utilisez notre adresse de livraison à Paris.")}
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--info-fg)", whiteSpace: "nowrap" }}>
            {tcx("Voir l’adresse")}
          </span>
        </button>
      )}
      <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 16 }}>Prévenez-nous d’un colis que vous attendez (ex : commande Shein), pour qu’on le retrouve plus vite à son arrivée.</div>
      <form onSubmit={submit} style={{ marginBottom: 18 }}>
        {honeypotField}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          <select value={provenance} onChange={(e) => setProvenance(e.target.value)} style={{ ...inputStyle, width: 130, marginBottom: 0 }}>
            {VENDEURS_EN_LIGNE.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
          <input value={trackingExterne} onChange={(e) => setTrackingExterne(e.target.value)} placeholder={tcx("Référence de la commande")} style={{ ...inputStyle, flex: 1, minWidth: 160, marginBottom: 0 }} />
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={tcx("Description (optionnel)")} style={{ ...inputStyle, flex: 1, minWidth: 160, marginBottom: 0 }} />
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          <input type="number" min="1" value={nbArticles} onChange={(e) => setNbArticles(e.target.value)} placeholder={tcx("Nombre d’articles")} style={{ ...inputStyle, flex: 1, minWidth: 140, marginBottom: 0 }} />
          <input type="number" step="0.01" min="0" value={valeurCommande} onChange={(e) => setValeurCommande(e.target.value)} placeholder="Valeur de la commande (€)" style={{ ...inputStyle, flex: 1, minWidth: 140, marginBottom: 0 }} />
        </div>
        <button type="submit" style={{ background: "var(--brand-solid)", color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{tcx("Ajouter la pré-alerte")}</button>
      </form>

      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>Mes pré-alertes ({preAlertes.length})</div>
      {preAlertes.length === 0 ? (
        <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{tcx("Aucune pré-alerte pour le moment.")}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {preAlertes.map((p) => (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--surface2)", borderRadius: 8, padding: "9px 12px" }}>
              <div>
                <div style={{ fontSize: 12.5, color: "var(--text)", fontWeight: 600 }}>
                  <span style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, padding: "1px 7px", fontSize: 10.5, marginInlineEnd: 6 }}>{p.provenance || "Autre"}</span>
                  {p.trackingExterne}{p.description ? ` — ${p.description}` : ""}
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>
                  {p.statut} · {new Date(p.dateCreation).toLocaleDateString("fr-FR")}
                  {p.nbArticles ? ` · ${p.nbArticles} article${p.nbArticles > 1 ? "s" : ""}` : ""}
                  {p.valeurCommande ? ` · ${fmt(p.valeurCommande, "EUR")}` : ""}
                </div>
              </div>
              <button onClick={() => onRemove(p.id)} style={{ background: "none", border: "none", color: "var(--danger-fg)", cursor: "pointer" }}><X size={15} /></button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

/** Historique de tous les paiements du client, tous colis confondus, en un seul endroit. */
/**
 * Déclaration de paiement Mobile Money par le client — pas de vraie intégration Orange
 * Money/MTN (ce qui demanderait un partenariat technique avec ces opérateurs). Le client
 * indique le montant et la référence de sa transaction ; un agent vérifie manuellement sur
 * son téléphone et confirme dans l’application avant que le paiement ne soit réellement
 * appliqué au colis.
 */
function DeclarationPaiementModal({ colis, onDeclarer, onClose }) {
  const [mode, setMode] = useState("Orange Money");
  const [devise, setDevise] = useState("GNF");
  const [montant, setMontant] = useState("");
  const [reference, setReference] = useState("");
  const [err, setErr] = useState("");

  function submit(e) {
    e.preventDefault();
    if (!montant || Number(montant) <= 0) { setErr("Indiquez le montant payé."); return; }
    if (!reference.trim()) { setErr("Indiquez la référence de la transaction (reçue par SMS)."); return; }
    onDeclarer(montant, devise, mode, reference.trim());
  }

  return (
    <Modal onClose={onClose} title="Déclarer un paiement" saisieEnCours={!!montant}>
      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16 }}>
        Colis <strong style={{ color: "var(--text)" }}>{colis.tracking}</strong> — reste à payer : <strong style={{ color: "var(--danger-fg)" }}>{fmt(colis.reste, "EUR")}</strong>
      </div>
      <form onSubmit={submit}>
        <Field label={tcx("Mode de paiement")}>
          <select value={mode} onChange={(e) => setMode(e.target.value)} style={inputStyle}>
            <option value="Orange Money">{tcx("Orange Money")}</option>
            <option value="MTN Mobile Money">{tcx("MTN Mobile Money")}</option>
          </select>
        </Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label={tcx("Montant payé")}><input type="number" step="0.01" value={montant} onChange={(e) => setMontant(e.target.value)} style={inputStyle} /></Field>
          <Field label={tcx("Devise")}>
            <select value={devise} onChange={(e) => setDevise(e.target.value)} style={inputStyle}>
              <option value="GNF">GNF</option>
              <option value="EUR">EUR</option>
            </select>
          </Field>
        </div>
        <Field label="Référence de la transaction (reçue par SMS)"><input value={reference} onChange={(e) => setReference(e.target.value)} style={inputStyle} placeholder="ex : MP240729.1234.A56789" /></Field>
        {err && <div style={{ color: "var(--danger-fg)", fontSize: 12.5, marginBottom: 10 }}>{err}</div>}
        <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>Un agent vérifiera cette transaction avant que le paiement ne soit appliqué à votre colis.</div>
        <button type="submit" style={{ width: "100%", background: "#5B8DEF", color: "#fff", border: "none", borderRadius: 8, padding: "11px 0", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>{tcx("Envoyer ma déclaration")}</button>
      </form>
    </Modal>
  );
}

function ClientPaiementsModal({ colisListe, onClose, devise = "GNF", onDeclarer }) {
  const paiements = colisListe.flatMap((c) => (c.paiements || []).map((p) => ({ ...p, tracking: c.tracking })))
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  const total = paiements.reduce((s, p) => s + (p.deviseSaisie ? p.montant / (LIVE_RATES[p.deviseSaisie] || 1) : p.montant), 0);
  const aRegler = colisListe.filter((c) => c.reste > 0 && c.status !== "Annulé");
  const totalDu = aRegler.reduce((s, c) => s + c.reste, 0);

  return (
    <Modal onClose={onClose} title={tcx("Mes paiements")} wide>
      {/*
        Cette fenêtre n'affichait qu'un historique, sans aucune action : le client qui venait
        pour payer repartait sans rien pouvoir faire, l'unique bouton se trouvant sur la carte
        du colis. Le solde et l'action de déclaration sont désormais ici aussi.
      */}
      {aRegler.length > 0 && (
        <div style={{ background: "var(--danger-bg)", border: "1px solid var(--danger-border)", borderRadius: 12, padding: 14, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
            <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{tcx("Reste à payer")}</span>
            <span style={{ fontSize: 17, fontWeight: 700, color: "var(--danger-fg)", fontFamily: "'Space Grotesk',sans-serif" }}>{fmt(totalDu, devise)}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {aRegler.map((c) => {
              const dejaDeclare = (c.declarationsPaiement || []).some((d) => d.statut === "En attente");
              return (
                <div key={c.tracking} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, background: "var(--surface)", borderRadius: 8, padding: "9px 12px", flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)" }}>{c.tracking}</div>
                    <div style={{ fontSize: 11.5, color: "var(--danger-fg)" }}>{fmt(c.reste, devise)}</div>
                  </div>
                  {dejaDeclare ? (
                    <span style={{ fontSize: 11.5, color: "var(--info-fg)" }}>{tcx("Paiement déclaré, en attente de vérification")}</span>
                  ) : onDeclarer ? (
                    <button onClick={() => onDeclarer(c)} style={{ background: "var(--brand-solid)", color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                      {tcx("J’ai payé")}
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ background: "var(--surface2)", borderRadius: 12, padding: 14, marginBottom: 16, display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
        <span style={{ color: "var(--muted)" }}>{tcx("Total payé (tous colis)")}</span>
        <span style={{ color: "var(--text)", fontWeight: 700 }}>{fmt(total, devise)}</span>
      </div>
      {paiements.length === 0 ? (
        <div style={{ fontSize: 12.5, color: "var(--muted)", textAlign: "center", padding: 20 }}>{tcx("Aucun paiement enregistré pour le moment.")}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {paiements.map((p) => (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--surface2)", borderRadius: 8, padding: "10px 12px" }}>
              <div>
                <div style={{ fontSize: 12.5, color: "var(--text)", fontWeight: 600 }}>{p.tracking} · {p.mode}</div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>{new Date(p.date).toLocaleString("fr-FR")}</div>
              </div>
              <div style={{ fontSize: 13, color: "var(--ok-fg)", fontWeight: 700 }}>{p.deviseSaisie ? fmt(p.montant, p.deviseSaisie) : fmt(p.montant, devise)}</div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}


/** Timeline visuelle du parcours d’un colis, en vocabulaire client (voir CLIENT_TIMELINE). */
function ClientTimeline({ status }) {
  if (status === "Annulé" || status === "Refusé") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", color: "var(--danger-fg)", fontSize: 12.5, fontWeight: 600 }}>
        <AlertTriangle size={15} /> {status === "Annulé" ? "Colis annulé" : "Colis refusé par le destinataire"}
      </div>
    );
  }
  const steps = CLIENT_TIMELINE.filter((s) => s.key !== "annonce");
  const currentIdx = clientTimelineIndex(status);
  return (
    <div style={{ display: "flex", alignItems: "flex-start", overflowX: "auto", padding: "10px 2px" }}>
      {steps.map((s, i) => {
        const done = currentIdx !== null && i < currentIdx;
        const current = currentIdx !== null && i === currentIdx;
        const color = done || current ? "#3ECB84" : "var(--border)";
        return (
          <div key={s.key} style={{ display: "flex", alignItems: "center", flex: i < steps.length - 1 ? 1 : "0 0 auto", minWidth: i < steps.length - 1 ? 70 : "auto" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 68 }}>
              <div style={{ width: 22, height: 22, borderRadius: "50%", background: done ? "#3ECB84" : current ? "#0A2647" : "var(--surface2)", border: current ? "2px solid #3ECB84" : "none", display: "grid", placeItems: "center", flexShrink: 0 }}>
                {done ? <Check size={12} color="#0A2647" /> : <div style={{ width: 6, height: 6, borderRadius: "50%", background: current ? "#3ECB84" : "var(--muted)" }} />}
              </div>
              <div style={{ fontSize: 9.5, color: done || current ? "var(--text)" : "var(--muted)", fontWeight: current ? 700 : 500, textAlign: "center", marginTop: 5, lineHeight: 1.25, maxWidth: 72 }}>{s.label}</div>
            </div>
            {i < steps.length - 1 && <div style={{ height: 2, flex: 1, background: color, marginBottom: 20, minWidth: 16 }} />}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Notifications à montrer au client : tout ce qui a bougé depuis sa dernière visite.
 * Extraite ici pour être appliquée AUSSI à la restauration de session — sinon un client qui
 * revient sans repasser par l'écran de connexion (session conservée) ne voyait plus aucune
 * notification, alors que c'est justement le cas le plus fréquent.
 */
function calculerNotificationsClient(acc, data) {
  if (!acc || !acc.derniereVisite || !data) return [];
  const seuil = new Date(acc.derniereVisite);
  const notifs = [];
  data.colis.filter((c) => c.clientAccountId === acc.id).forEach((c) => {
    (c.historique || []).forEach((h) => {
      if (new Date(h.date) > seuil) notifs.push({ icone: "\ud83d\udce6", texte: `${c.tracking} — statut : ${clientStatusLabel(h.status)}`, date: h.date });
    });
    (c.signalements || []).forEach((sg) => {
      if (sg.dateReponse && new Date(sg.dateReponse) > seuil) notifs.push({ icone: "\u26a0\ufe0f", texte: `${c.tracking} — réponse à votre signalement : ${sg.reponse}`, date: sg.dateReponse });
    });
    const ex = c.demandeExpress;
    if (ex && ex.dateDecision && new Date(ex.dateDecision) > seuil) {
      notifs.push({
        icone: ex.statut === "Confirmée" ? "\u26a1" : "\u2716\ufe0f",
        texte: ex.statut === "Confirmée"
          ? `${c.tracking} — votre livraison express est acceptée (72 h)`
          : `${c.tracking} — votre demande de livraison express n'a pas pu être acceptée`,
        date: ex.dateDecision,
      });
    }
  });
  (acc.messages || []).forEach((m) => {
    if (m.expediteur === "staff" && new Date(m.date) > seuil) notifs.push({ icone: "\ud83d\udcac", texte: `Nouveau message de l’agence : ${String(m.texte || "").slice(0, 60)}`, date: m.date });
  });
  (data.demandesRegroupement || []).filter((dm) => dm.clientAccountId === acc.id).forEach((dm) => {
    if (dm.dateMaj && new Date(dm.dateMaj) > seuil && dm.statut !== "En attente") notifs.push({ icone: "\ud83d\udcec", texte: `Demande de regroupement : ${dm.statut}`, date: dm.dateMaj });
  });
  return notifs.sort((a, b) => new Date(b.date) - new Date(a.date));
}

function ClientPortalPage({ data, loading, persist }) {
  const [lang, setLang] = useClientLang();
  const T = (x) => tc(x, lang);
  const [mode, setMode] = useState("login"); // login | inscription | reset
  const [identifiant, setIdentifiant] = useState("");
  const [motdepasse, setMotdepasse] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState("");
  const [compte, setCompte] = useState(null);
  const [sessionClientRestauree, setSessionClientRestauree] = useState(false);

  // Même principe que pour les agents : la session survit à un rechargement et à un changement
  // d'onglet, mais se ferme après 10 minutes sans action. Seul l'identifiant du compte est
  // conservé sur l'appareil, jamais le mot de passe.
  useEffect(() => {
    if (sessionClientRestauree || !data || compte) return;
    const id = lireSessionClient();
    if (id) {
      const acc = (data.clientAccounts || []).find((c) => c.id === id);
      if (acc) {
        // Mêmes notifications qu'à une connexion classique, puis la date de visite est mise à jour.
        setNotifications(calculerNotificationsClient(acc, data));
        const rafraichi = { ...acc, derniereVisite: new Date().toISOString() };
        persist({ ...data, clientAccounts: (data.clientAccounts || []).map((c) => (c.id === acc.id ? rafraichi : c)) });
        setCompte(rafraichi);
      }
    }
    setSessionClientRestauree(true);
  }, [data, compte, sessionClientRestauree]);

  useEffect(() => {
    if (!compte) return;
    let derniereEcriture = 0;
    const marquerActivite = () => {
      const maintenant = Date.now();
      if (maintenant - derniereEcriture < 20000) return;
      derniereEcriture = maintenant;
      ecrireSessionClient(compte.id);
    };
    const evenements = ["click", "keydown", "touchstart", "scroll", "pointerdown"];
    evenements.forEach((e) => window.addEventListener(e, marquerActivite, { passive: true }));
    marquerActivite();
    const minuteur = setInterval(() => { if (!lireSessionClient()) setCompte(null); }, 30000);
    return () => {
      evenements.forEach((e) => window.removeEventListener(e, marquerActivite));
      clearInterval(minuteur);
    };
  }, [compte]);
  const [filtreStatut, setFiltreStatut] = useState("tous");
  const [showProfil, setShowProfil] = useState(false);
  const [showPreAlerte, setShowPreAlerte] = useState(false);
  const [showPaiements, setShowPaiements] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [declarantPour, setDeclarantPour] = useState(null);
  const [signalantPour, setSignalantPour] = useState(null);
  const [showMessages, setShowMessages] = useState(false);
  const [showRegroupement, setShowRegroupement] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showVerif, setShowVerif] = useState(false);
  /*
   * Devise d'affichage côté client. Le franc guinéen est la valeur par défaut : c'est la monnaie
   * dans laquelle le client paiera à l'agence. Il peut basculer vers n'importe quelle devise
   * gérée par la plateforme, le choix étant mémorisé sur son appareil.
   */
  const [deviseClient, setDeviseClient] = useState(() => {
    try { return window.localStorage.getItem("bde-devise-client") || "GNF"; } catch (e) { return "GNF"; }
  });
  function choisirDevise(d) {
    setDeviseClient(d);
    try { window.localStorage.setItem("bde-devise-client", d); } catch (e) {}
  }

  if (loading || !data) return <BrandedLoader />;

  async function connecter(e) {
    e.preventDefault();
    setErr("");
    const acc = (data.clientAccounts || []).find((c) => c.identifiant.toLowerCase() === identifiant.trim().toLowerCase());
    if (!acc) { setErr("Identifiant ou mot de passe incorrect."); return; }
    // On transmet le compte ENTIER : un objet partiel ferait perdre motdepasseAlgo/motdepasseIter
    // et la vérification retomberait sur l'ancien schéma, rendant la connexion impossible.
    const { ok, migratedUser } = await verifyPassword(motdepasse, acc);
    if (!ok) { setErr("Identifiant ou mot de passe incorrect."); return; }

    setNotifications(calculerNotificationsClient(acc, data));

    // Un SEUL enregistrement combinant la date de visite et, le cas échéant, la mise à niveau du
    // mot de passe vers PBKDF2. Deux persist() successifs se seraient écrasés l'un l'autre : le
    // second, construit à partir de `data` non rafraîchi, effaçait la migration.
    const updated = { ...acc, ...(migratedUser || {}), derniereVisite: new Date().toISOString() };
    persist({ ...data, clientAccounts: (data.clientAccounts || []).map((c) => (c.id === acc.id ? updated : c)) });
    ecrireSessionClient(updated.id); setCompte(updated);
  }

  const mesColis = compte && data ? data.colis.filter((c) => c.clientAccountId === compte.id) : [];
  // Agence de retrait affichée au client, choisie par l'administrateur (Bambeto par défaut).
  const agenceRetrait = data ? (data.sites || []).find((s) => s.id === (data.agenceRetraitClient || "site-bambeto")) || (data.sites || [])[0] : null;

  const enCours = mesColis.filter((c) => c.status !== "Livré" && c.status !== "Annulé");
  const livres = mesColis.filter((c) => c.status === "Livré");
  const nonPayes = mesColis.filter((c) => c.reste > 0 && c.status !== "Annulé");
  const totalRestant = nonPayes.reduce((s, c) => s + c.reste, 0);
  const expressTarif = data.expressTarifEurKg ?? 12;

  function demanderExpress(c) {
    const montant = +(c.poids * expressTarif).toFixed(2);
    const demande = { statut: "En attente", montant, demandeLe: new Date().toISOString() };
    persist({ ...data, colis: data.colis.map((x) => (x.tracking === c.tracking ? { ...x, demandeExpress: demande } : x)) });
  }

  const mesPreAlertes = compte ? (data.preAlertes || []).filter((p) => p.clientAccountId === compte.id) : [];
  function ajouterPreAlerte(trackingExterne, description, provenance, extra) {
    const p = { id: `pa${Date.now()}`, clientAccountId: compte.id, trackingExterne, description, provenance, dateCreation: new Date().toISOString(), statut: "En attente", ...extra };
    persist({ ...data, preAlertes: [p, ...(data.preAlertes || [])] });
  }
  function retirerPreAlerte(id) {
    persist({ ...data, preAlertes: (data.preAlertes || []).filter((p) => p.id !== id) });
  }
  function majProfil(patch) {
    const updated = { ...compte, ...patch };
    persist({ ...data, clientAccounts: (data.clientAccounts || []).map((c) => (c.id === compte.id ? updated : c)) });
    setCompte(updated);
  }
  function declarerPaiement(c, montant, devise, mode, reference) {
    const declaration = { id: `decl${Date.now()}`, montant: Number(montant), devise, mode, reference, statut: "En attente", dateDeclaration: new Date().toISOString() };
    persist({ ...data, colis: data.colis.map((x) => (x.tracking === c.tracking ? { ...x, declarationsPaiement: [...(x.declarationsPaiement || []), declaration] } : x)) });
  }
  function signalerProbleme(c, message) {
    const signalement = { id: `sig${Date.now()}`, message, statut: "Ouvert", dateCreation: new Date().toISOString(), reponse: null };
    persist({ ...data, colis: data.colis.map((x) => (x.tracking === c.tracking ? { ...x, signalements: [...(x.signalements || []), signalement] } : x)) });
  }
  function envoyerMessage(texte) {
    const msg = { id: `msg${Date.now()}`, expediteur: "client", texte, date: new Date().toISOString(), lu: false };
    const updated = { ...compte, messages: [...(compte.messages || []), msg] };
    persist({ ...data, clientAccounts: (data.clientAccounts || []).map((c) => (c.id === compte.id ? updated : c)) });
    setCompte(updated);
  }
  function demanderRegroupement(trackings, note) {
    const demande = { id: `regr${Date.now()}`, clientAccountId: compte.id, trackings, note, statut: "En attente", dateCreation: new Date().toISOString() };
    persist({ ...data, demandesRegroupement: [demande, ...(data.demandesRegroupement || [])] });
  }

  const mesPreAlertesEnAttenteCount = compte ? (data.preAlertes || []).filter((p) => p.clientAccountId === compte.id && p.statut === "En attente").length : 0;
  const statsClient = {
    total: mesColis.length,
    enAttente: mesPreAlertesEnAttenteCount,
    recusEntrepot: mesColis.filter((c) => c.status === "Enregistré").length,
    expedies: mesColis.filter((c) => c.status === "En transit").length,
    arrivesGuinee: mesColis.filter((c) => ["Arrivé", "Disponible au retrait"].includes(c.status)).length,
    livres: mesColis.filter((c) => c.status === "Livré").length,
    poidsTotal: mesColis.reduce((s, c) => s + (c.poids || 0), 0),
    montantPaye: mesColis.reduce((s, c) => s + (c.paye || 0), 0),
    montantRestant: mesColis.reduce((s, c) => s + (c.reste || 0), 0),
  };
  // Fidélité — reprend exactement le même barème que celui appliqué automatiquement sur le prix
  // à la création d’un colis (loyaltyDiscount, basé sur le nombre d’envois), pour que le client
  // voie la même réduction que celle réellement appliquée par l’agence, pas un chiffre inventé.
  const nbEnvois = mesColis.filter((c) => c.status !== "Annulé").length;
  const remiseActuelle = loyaltyDiscount(nbEnvois);
  const seuils = [3, 6, 11];
  const prochainSeuil = seuils.find((s) => nbEnvois < s) || null;

  const listeAffichee = mesColis.filter((c) => {
    if (filtreStatut === "tous") return true;
    if (filtreStatut === "en_cours") return c.status !== "Livré" && c.status !== "Annulé";
    if (filtreStatut === "livres") return c.status === "Livré";
    if (filtreStatut === "impayes") return c.reste > 0;
    return true;
  });

  if (!compte) {
    return (
      <div dir={lang === "ar" ? "rtl" : "ltr"} style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column", alignItems: "center", padding: "60px 16px" }}>
        <div style={{ width: "100%", maxWidth: 420, display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
          <ClientLangSwitch lang={lang} onChange={setLang} />
        </div>
        <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 22, color: "var(--text)", marginBottom: 4 }}>{T("Espace Client")}</div>
        <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 28, textAlign: "center" }}>{T("Retrouvez tous vos colis, leurs statuts et vos paiements en un coup d'œil.")}</div>

        {mode === "inscription" ? (
          <ClientRegisterForm data={data} persist={persist} onRegistered={(acc) => { ecrireSessionClient(acc.id); setCompte(acc); }} onCancel={() => setMode("login")} />
        ) : mode === "reset" ? (
          <ClientResetPasswordForm data={data} persist={persist} onDone={() => { setMode("login"); setErr(""); }} onCancel={() => setMode("login")} />
        ) : (
          <form onSubmit={connecter} style={{ width: "100%", maxWidth: 380, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 24 }}>
            <Field label={T("Identifiant")}><input value={identifiant} onChange={(e) => setIdentifiant(e.target.value)} style={inputStyle} autoFocus /></Field>
            <Field label={T("Mot de passe")}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input type={showPw ? "text" : "password"} autoComplete="current-password" value={motdepasse} onChange={(e) => setMotdepasse(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                <button type="button" onClick={() => setShowPw((s) => !s)} style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, width: 34, height: 34, cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0 }}>
                  {showPw ? <EyeOff size={14} color="var(--muted)" /> : <Eye size={14} color="var(--muted)" />}
                </button>
              </div>
            </Field>
            {err && <div style={{ color: "var(--danger-fg)", fontSize: 12.5, marginBottom: 10 }}>{err}</div>}
            <button type="submit" style={{ width: "100%", marginTop: 4, background: "var(--brand-solid)", color: "#fff", border: "none", borderRadius: 8, padding: "11px 0", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>{T("Se connecter")}</button>
            <button type="button" onClick={() => { setMode("reset"); setErr(""); }} style={{ width: "100%", marginTop: 10, background: "none", border: "none", color: "var(--muted)", fontSize: 12, cursor: "pointer" }}>{T("Mot de passe oublié ?")}</button>
            <button type="button" onClick={() => { setMode("inscription"); setErr(""); }} style={{ width: "100%", marginTop: 6, background: "none", border: "1.5px solid var(--border)", borderRadius: 8, padding: "10px 0", fontSize: 13, fontWeight: 600, color: "var(--text)", cursor: "pointer" }}>{T("Créer un compte")}</button>
          </form>
        )}
      </div>
    );
  }

  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"} style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 20px 60px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 10 }}>
          <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 20, color: "var(--text)" }}>{T("Espace Client")}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={() => setShowGuide(true)} style={{ background: "var(--brand-solid)", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, color: "#fff", fontWeight: 600, cursor: "pointer" }}>{T("Comment commander")}</button>
            <button onClick={() => setShowPreAlerte(true)} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 12px", fontSize: 12, color: "var(--text)", cursor: "pointer" }}>{T("Pré-alerte colis")}</button>
            <button onClick={() => setShowVerif(true)} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 12px", fontSize: 12, color: "var(--text)", cursor: "pointer" }}>{T("Vérifier une référence")}</button>
            <button onClick={() => {
              setShowMessages(true);
              if ((compte.messages || []).some((m) => m.expediteur === "staff" && !m.lu)) {
                const updated = { ...compte, messages: (compte.messages || []).map((m) => (m.expediteur === "staff" ? { ...m, lu: true } : m)) };
                persist({ ...data, clientAccounts: (data.clientAccounts || []).map((c) => (c.id === compte.id ? updated : c)) });
                setCompte(updated);
              }
            }} style={{ position: "relative", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 12px", fontSize: 12, color: "var(--text)", cursor: "pointer" }}>
              Messages
              {(compte.messages || []).some((m) => m.expediteur === "staff" && !m.lu) && <span style={{ position: "absolute", top: -4, right: -4, width: 9, height: 9, borderRadius: "50%", background: "var(--brand-solid)" }} />}
            </button>
            {statsClient.recusEntrepot > 1 && <button onClick={() => setShowRegroupement(true)} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 12px", fontSize: 12, color: "var(--text)", cursor: "pointer" }}>{T("Regrouper mes colis")}</button>}
            <button onClick={() => setShowPaiements(true)} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 12px", fontSize: 12, color: "var(--text)", cursor: "pointer" }}>{T("Mes paiements")}</button>
            <button onClick={() => setShowProfil(true)} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 12px", fontSize: 12, color: "var(--text)", cursor: "pointer" }}>{T("Mon profil")}</button>
            {mesColis.length > 0 && <button onClick={() => downloadClientManifest(compte, mesColis, deviseClient)} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 12px", fontSize: 12, color: "var(--text)", cursor: "pointer" }}>{T("Mon bordereau (PDF)")}</button>}
            <ClientLangSwitch lang={lang} onChange={setLang} />
            <button onClick={() => { ecrireSessionClient(null); setCompte(null); setIdentifiant(""); setMotdepasse(""); setMode("login"); }} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 12px", fontSize: 12, color: "var(--muted)", cursor: "pointer" }}>{T("Déconnexion")}</button>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 22 }}>
          <div style={{ fontSize: 13, color: "var(--muted)" }}>{T(salutationSelonHeure())} {compte.prenom} {compte.nom}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: remiseActuelle >= 12 ? "var(--warn-bg)" : remiseActuelle > 0 ? "var(--surface2)" : "var(--bronze-bg)", border: "1px solid " + (remiseActuelle >= 12 ? "var(--warn-border)" : "var(--border)"), borderRadius: 20, padding: "5px 12px" }}>
            <span style={{ fontSize: 12 }}>{remiseActuelle >= 12 ? "🥇" : remiseActuelle > 0 ? "🥈" : "🥉"}</span>
            <span style={{ fontSize: 11.5, color: "var(--text)", fontWeight: 700 }}>{nbEnvois} {T(nbEnvois > 1 ? "envois" : "envoi")}{remiseActuelle > 0 ? ` — ${remiseActuelle}% ${T("de réduction fidélité")}` : ""}</span>
            {prochainSeuil && <span style={{ fontSize: 10.5, color: "var(--muted)" }}>({prochainSeuil - nbEnvois} {T("avant")} {loyaltyDiscount(prochainSeuil)}%)</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{T("Afficher les montants en")}</span>
            <select value={deviseClient} onChange={(e) => choisirDevise(e.target.value)}
              style={{ ...inputStyle, width: "auto", marginBottom: 0, padding: "5px 10px", fontSize: 12, fontWeight: 600 }}>
              {Object.keys(CURRENCIES).map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>

        {notifications.length > 0 && (
          <div style={{ background: "var(--info-bg-alt)", border: "1px solid var(--info-border)", borderRadius: 12, marginBottom: 18, overflow: "hidden" }}>
            <button onClick={() => setShowNotifs((s) => !s)} style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", background: "none", border: "none", padding: "10px 14px", cursor: "pointer" }}>
              <span style={{ fontSize: 12.5, color: "var(--info-fg)" }}>🔔 {notifications.length} nouveauté{notifications.length > 1 ? "s" : ""} depuis votre dernière visite</span>
              <ChevronRight size={14} color="var(--info-fg)" style={{ transform: showNotifs ? "rotate(90deg)" : "none" }} />
            </button>
            {showNotifs && (
              <div style={{ borderTop: "1px solid var(--info-border)", padding: "6px 14px 12px" }}>
                {notifications.map((n, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, padding: "6px 0", borderTop: i > 0 ? "1px solid rgba(91,141,239,0.15)" : "none" }}>
                    <span style={{ fontSize: 13 }}>{n.icone}</span>
                    <div>
                      <div style={{ fontSize: 12, color: "var(--text)" }}>{n.texte}</div>
                      <div style={{ fontSize: 10, color: "var(--muted)" }}>{new Date(n.date).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {showProfil && <ClientProfilModal compte={compte} onSave={majProfil} onClose={() => setShowProfil(false)} />}
        {showPreAlerte && <ClientPreAlerteModal preAlertes={mesPreAlertes} onAdd={ajouterPreAlerte} onRemove={retirerPreAlerte} onClose={() => setShowPreAlerte(false)} onVoirGuide={() => { setShowPreAlerte(false); setShowGuide(true); }} />}
        {showPaiements && <ClientPaiementsModal colisListe={mesColis} onClose={() => setShowPaiements(false)} devise={deviseClient} onDeclarer={(c) => { setShowPaiements(false); setDeclarantPour(c); }} />}
        {declarantPour && <DeclarationPaiementModal colis={declarantPour} onDeclarer={(m, d, mo, r) => { declarerPaiement(declarantPour, m, d, mo, r); setDeclarantPour(null); }} onClose={() => setDeclarantPour(null)} />}

        {/*
          Prochains départs. Placé avant les statistiques : c'est la question que le client se pose
          en arrivant, avant même de regarder où en sont ses colis. Les départs dont la date limite
          est dépassée ne sont pas affichés — annoncer une échéance intenable serait pire que rien.
        */}
        {departsAVenir(data.departs).length > 0 && (
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderInlineStart: "4px solid var(--info-fg)", borderRadius: 12, padding: "14px 18px", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
              <Plane size={15} color="var(--info-fg)" />
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{T("Prochains départs")}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {departsAVenir(data.departs).slice(0, 4).map((d) => {
                const jours = Math.ceil((new Date(d.dateLimite).getTime() - Date.now()) / 86400000);
                const urgent = jours <= 2;
                const paysDep = COUNTRIES.find((c) => c.code === d.pays);
                return (
                  <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", background: "var(--surface2)", borderRadius: 8, padding: "9px 12px" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)" }}>
                        {FLAGS[d.pays] || ""} {paysDep?.city || d.pays} · {d.mode === "air" ? T("Aérien") : T("Maritime")}
                      </div>
                      {d.note && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{d.note}</div>}
                    </div>
                    <div style={{ textAlign: "end", flexShrink: 0 }}>
                      <div style={{ fontSize: 11.5, fontWeight: 700, color: urgent ? "var(--warn-fg)" : "var(--ok-fg)" }}>
                        {jours <= 0 ? T("Dernier jour") : `${T("Dépôt jusqu’au")} ${new Date(d.dateLimite).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`}
                      </div>
                      <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 1 }}>
                        {T("Départ le")} {new Date(d.dateDepart).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12, marginBottom: 22 }}>
          <StatCard label={T("Total colis")} value={statsClient.total} icon={Package} tint="#3D63FF" />
          <StatCard label={T("En attente")} value={statsClient.enAttente} icon={Clock} tint="#6B7A99" />
          <StatCard label={T("Reçus à l’entrepôt")} value={statsClient.recusEntrepot} icon={Package} tint="#5B8DEF" />
          <StatCard label={T("Expédiés")} value={statsClient.expedies} icon={Plane} tint="#5B8DEF" />
          <StatCard label={T("Arrivés en Guinée")} value={statsClient.arrivesGuinee} icon={MapPin} tint="#B8801C" />
          <StatCard label={T("Livrés")} value={statsClient.livres} icon={CheckCircle2} tint="#16A163" />
          <StatCard label={T("Poids total")} value={`${statsClient.poidsTotal.toFixed(1)} kg`} icon={FileStack} tint="#8B5CF6" />
          <StatCard label={T("Montant payé")} value={fmt(statsClient.montantPaye, deviseClient)} icon={DollarSign} tint="#16A163" />
          <StatCard label={T("Reste à payer")} value={fmt(statsClient.montantRestant, deviseClient)} icon={DollarSign} tint={statsClient.montantRestant > 0 ? "var(--brand-solid)" : "#3ECB84"} />
        </div>

        {nonPayes.length > 0 && (
          <div style={{ background: "var(--danger-bg)", border: "1px solid var(--danger-border)", borderRadius: 12, padding: 14, marginBottom: 22, display: "flex", alignItems: "center", gap: 10 }}>
            <AlertTriangle size={18} color="var(--danger-fg)" />
            <div style={{ fontSize: 12.5, color: "var(--danger-fg-soft)" }}>{nonPayes.length} colis en attente de paiement — {fmt(totalRestant, deviseClient)} au total.</div>
          </div>
        )}

        {mesColis.length === 0 ? (
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 30, textAlign: "center", color: "var(--muted)", fontSize: 13.5 }}>
            <div style={{ marginBottom: 14 }}>{T("Aucun colis rattaché à votre compte pour le moment.")}</div>
            <div style={{ fontSize: 12.5, marginBottom: 14 }}>{T("Pour recevoir vos achats en ligne, indiquez notre adresse de Paris comme adresse de livraison au moment de commander.")}</div>
            <button onClick={() => setShowGuide(true)} style={{ background: "var(--brand-solid)", border: "none", borderRadius: 8, padding: "11px 22px", fontSize: 13.5, color: "#fff", fontWeight: 700, cursor: "pointer" }}>
              {T("Voir l’adresse de livraison")}
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              {[["tous", "Tous"], ["en_cours", "En cours"], ["livres", "Livrés"], ["impayes", "Non payés"]].map(([k, label]) => (
                <button key={k} onClick={() => setFiltreStatut(k)} style={{ padding: "7px 14px", borderRadius: 20, border: "1.5px solid " + (filtreStatut === k ? "var(--brand-solid)" : "var(--border)"), background: filtreStatut === k ? "var(--brand-solid)" : "var(--surface)", color: filtreStatut === k ? "#fff" : "var(--muted)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{label}</button>
              ))}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {listeAffichee.map((c) => {
                const st = STATUS_STYLE[c.status];
                return (
                  <div key={c.tracking} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 8 }}>
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)" }}>{c.tracking}{c.provenance && <span style={{ marginInlineStart: 8, background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 6, padding: "1px 7px", fontSize: 10, fontWeight: 600, color: "var(--muted)" }}>{c.provenance}</span>}</div>
                        {c.litige && (
                          <div style={{ background: c.litige.statut === "Ouvert" ? "var(--warn-bg)" : "var(--ok-bg)",
                                        border: "1px solid " + (c.litige.statut === "Ouvert" ? "var(--warn-border)" : "var(--ok-border)"),
                                        borderRadius: 8, padding: "9px 12px", marginTop: 10 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: c.litige.statut === "Ouvert" ? "var(--warn-fg)" : "var(--ok-fg)" }}>
                              {c.litige.type === "perdu" ? T("Colis signalé perdu") : T("Colis signalé endommagé")}
                              {c.litige.statut === "Résolu" ? ` — ${T("réglé")}` : ""}
                            </div>
                            <div style={{ fontSize: 11.5, color: "var(--text)", marginTop: 3 }}>
                              {c.litige.statut === "Résolu" ? c.litige.resolution : T("Notre équipe traite votre dossier et vous recontacte.")}
                            </div>
                          </div>
                        )}
                        {["Disponible au retrait"].includes(c.status) && agenceRetrait && (
                          <div style={{ background: "var(--ok-bg)", border: "1px solid var(--ok-border)", borderRadius: 12, padding: "10px 12px", marginTop: 10 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ok-fg)" }}>{T("Votre colis vous attend")} — {agenceRetrait.nom}</div>
                            <div style={{ fontSize: 11.5, color: "var(--text)", marginTop: 3 }}>{agenceRetrait.adresse}</div>
                            <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>
                              {agenceRetrait.horaires ? `${agenceRetrait.horaires} · ` : ""}{agenceRetrait.telephone}
                            </div>
                            {agenceRetrait.paiements && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{T("Paiement accepté")} : {agenceRetrait.paiements}</div>}
                            {agenceRetrait.stockage && <div style={{ fontSize: 11, color: "var(--warn-fg)", marginTop: 3 }}>{agenceRetrait.stockage}</div>}
                          </div>
                        )}
                        {c.referenceCommande && (
                          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                            {T("Votre référence de commande")} : <strong style={{ color: "var(--text)" }}>{c.referenceCommande}</strong>
                          </div>
                        )}
                        <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{routeLabel(c.pays, c.direction)} · {c.poids} kg · {new Date(c.createdAt).toLocaleDateString("fr-FR")}</div>
                        {c.status !== "Livré" && c.status !== "Annulé" && (() => {
                          const pays = COUNTRIES.find((x) => x.code === c.pays);
                          const delai = c.mode === "air" ? pays?.delayAir : pays?.delaySea;
                          if (!delai) return null;
                          const debut = new Date(c.createdAt);
                          const min = new Date(debut); min.setDate(min.getDate() + Math.max(1, delai - 2));
                          const max = new Date(debut); max.setDate(max.getDate() + delai + 2);
                          return <div style={{ fontSize: 11, color: "var(--info-fg)", marginTop: 2 }}>📅 Réception estimée entre le {min.toLocaleDateString("fr-FR")} et le {max.toLocaleDateString("fr-FR")}</div>;
                        })()}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <span style={{ background: st?.bg, color: st?.fg, padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{clientStatusLabel(c.status)}</span>
                        <span style={{ fontSize: 11.5, fontWeight: 700, color: c.reste > 0 ? "var(--danger-fg)" : "var(--ok-fg)" }}>{c.reste > 0 ? `${fmt(c.reste, deviseClient)} dû` : "Payé"}</span>
                        <button onClick={() => downloadInvoice(c, data)} style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px", fontSize: 11, color: "var(--text)", cursor: "pointer" }}>{T("Facture")}</button>
                        <a href={`https://wa.me/224612479339?text=${encodeURIComponent(`Bonjour, j’ai une question concernant mon colis ${c.tracking}.`)}`} target="_blank" rel="noopener noreferrer" style={{ background: "var(--ok-bg-soft)", border: "1px solid var(--ok-border)", borderRadius: 8, padding: "6px 10px", fontSize: 11, color: "var(--ok-fg)", textDecoration: "none" }}>💬 Contacter (GN)</a>
                        <a href={`https://wa.me/33767562963?text=${encodeURIComponent(`Bonjour, j’ai une question concernant mon colis ${c.tracking}.`)}`} target="_blank" rel="noopener noreferrer" style={{ background: "var(--ok-bg-soft)", border: "1px solid var(--ok-border)", borderRadius: 8, padding: "6px 10px", fontSize: 11, color: "var(--ok-fg)", textDecoration: "none" }}>💬 Contacter (FR)</a>
                      </div>
                    </div>
                    <ClientTimeline status={c.status} />
                    {c.photoEntrepot && (
                      <div style={{ marginTop: 10 }}>
                        <img src={c.photoEntrepot} alt="Photo du colis à l’entrepôt" style={{ maxWidth: 180, borderRadius: 8, border: "1px solid var(--border)" }} />
                      </div>
                    )}
                    {c.status !== "Livré" && c.status !== "Annulé" && (
                      <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
                        {c.demandeExpress ? (
                          <div style={{ fontSize: 11.5, color: "var(--warn-fg)" }}>⚡ Livraison express demandée ({fmt(c.demandeExpress.montant, deviseClient)}) — {c.demandeExpress.statut}</div>
                        ) : (
                          <button onClick={() => demanderExpress(c)} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "1px solid #E0A63A", borderRadius: 8, padding: "6px 12px", fontSize: 11.5, color: "var(--warn-fg)", fontWeight: 600, cursor: "pointer" }}>
                            ⚡ Demander une livraison express (72h) — {fmt(c.poids * expressTarif, deviseClient)}
                          </button>
                        )}
                      </div>
                    )}
                    {c.reste > 0 && c.status !== "Annulé" && (
                      <div style={{ marginTop: 8 }}>
                        {(c.declarationsPaiement || []).filter((d) => d.statut === "En attente").length > 0 ? (
                          <div style={{ fontSize: 11.5, color: "var(--info-fg)" }}>💳 Paiement déclaré, en attente de vérification par l’agence</div>
                        ) : (
                          <button onClick={() => setDeclarantPour(c)} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "1px solid #5B8DEF", borderRadius: 8, padding: "6px 12px", fontSize: 11.5, color: "var(--info-fg)", fontWeight: 600, cursor: "pointer" }}>
                            💳 J’ai payé par Orange Money / MTN
                          </button>
                        )}
                      </div>
                    )}
                    <div style={{ marginTop: 8 }}>
                      {(c.signalements || []).some((s) => s.statut === "Ouvert") ? (
                        <div style={{ fontSize: 11.5, color: "var(--warn-fg)" }}>⚠️ Problème signalé, en attente de réponse</div>
                      ) : (c.signalements || []).length > 0 && (c.signalements || []).every((s) => s.statut === "Résolu") ? (
                        <div style={{ fontSize: 11.5, color: "var(--ok-fg)" }}>✓ {(c.signalements[c.signalements.length - 1]).reponse}</div>
                      ) : (
                        <button onClick={() => setSignalantPour(c)} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 12px", fontSize: 11.5, color: "var(--muted)", fontWeight: 600, cursor: "pointer" }}>
                          ⚠️ Signaler un problème
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {signalantPour && <SignalerProblemeModal colis={signalantPour} onSignaler={(msg) => { signalerProbleme(signalantPour, msg); setSignalantPour(null); }} onClose={() => setSignalantPour(null)} />}
        {showVerif && <VerifierReferenceModal data={data} compteClient={compte} onClose={() => setShowVerif(false)} />}
        {showMessages && <ClientMessagesModal compte={compte} onSend={envoyerMessage} onClose={() => setShowMessages(false)} />}
        {showGuide && <GuideCommandeModal compte={compte} agence={(data.agencesReception || {}).FR} onClose={() => setShowGuide(false)} />}
        {showRegroupement && <RegroupementModal colisEligibles={mesColis.filter((c) => c.status === "Enregistré")} onDemander={(trackings, note) => { demanderRegroupement(trackings, note); setShowRegroupement(false); }} onClose={() => setShowRegroupement(false)} />}


        <div style={{ textAlign: "center", fontSize: 11, color: "var(--muted)", marginTop: 30 }}>{T("Ba-Diaby Express — Transport de colis Conakry - Monde")}</div>
      </div>
    </div>
  );
}


/**

 * Page d’accueil publique (site vitrine) — ce que voit n’importe quel visiteur qui arrive sur le
 * domaine sans être connecté. Combine la présentation de l’entreprise (personnalisable dans
 * Configuration → Site Vitrine Public) avec le suivi de colis en direct, sans obliger le client à
 * se connecter. Le personnel accède à l’espace de gestion via "Se connecter" en haut à droite.
 */
function SiteVitrineHomePage({ data, onConnexionClick }) {
  // Idem : "lang" est requis pour la direction du texte. Sans ce hook, la page d’accueil
  // publique plantait pour tout visiteur arrivant avec un navigateur vierge.
  const [lang] = useClientLang();
  const site = data.siteVitrine || {};
  const nomPublic = site.nomPublic || "Ba-Diaby Express";
  const tagline = site.tagline || "Le pont entre la Guinée et le monde";
  const trackingActif = site.trackingPublic !== false;
  const [code, setCode] = useState("");
  const [selectedPays, setSelectedPays] = useState(null);
  const isMobile = useIsMobile();

  function suivre(e) {
    e.preventDefault();
    if (!code.trim()) return;
    const url = new URL(window.location.href);
    url.search = ""; url.searchParams.set("suivi", "1"); url.searchParams.set("code", code.trim());
    window.location.href = url.toString();
  }

  const destinations = COUNTRIES.filter((c) => c.code !== "GN");
  const selectedCountry = selectedPays ? destinations.find((c) => c.code === selectedPays) : null;
  const selectedDep = selectedPays ? (data.departures || {})[selectedPays] || {} : null;

  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"} style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 19, color: "var(--text)" }}>
          <img src={data.branding?.logo || DEFAULT_LOGO} alt="logo" style={{ width: 26, height: 26, borderRadius: 6, objectFit: "cover", verticalAlign: "middle", marginInlineEnd: 8 }} />
          {nomPublic.split(" ")[0]} <span style={{ color: "var(--danger-fg)" }}>{nomPublic.split(" ").slice(1).join(" ")}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => {
            const url = new URL(window.location.href);
            url.search = ""; url.searchParams.set("client", "1");
            window.location.href = url.toString();
          }} style={{ background: "none", border: "none", fontSize: 13, fontWeight: 600, color: "var(--text)", cursor: "pointer" }}>Espace Client</button>
          <button onClick={onConnexionClick} style={{ background: "var(--surface)", border: "1.5px solid var(--border)", color: "var(--text)", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Se connecter</button>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: "40px auto 0", padding: "0 24px", textAlign: "center" }}>
        <h1 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: "clamp(26px, 5vw, 40px)", color: "var(--text)", margin: "0 0 12px", lineHeight: 1.2 }}>{tagline}</h1>
        <p style={{ fontSize: 15, color: "var(--muted)", marginBottom: 32 }}>Transport de colis rapide et fiable entre la Guinée et {destinations.length} destinations dans le monde.</p>

        {trackingActif && (
          <form onSubmit={suivre} style={{ display: "flex", gap: 8, maxWidth: 460, margin: "0 auto 40px", flexWrap: "wrap", justifyContent: "center" }}>
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Entrez votre numéro de suivi (ex : BDE123456)" style={{ ...inputStyle, flex: 1, minWidth: 220, fontSize: 14.5, padding: "13px 16px" }} />
            <button type="submit" style={{ background: "var(--brand-solid)", color: "#fff", border: "none", borderRadius: 8, padding: "0 22px", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Suivre mon colis</button>
          </form>
        )}
      </div>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "0 24px 60px" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", letterSpacing: 0.5, textAlign: "center", marginBottom: 6 }}>NOS DESTINATIONS</div>
        <div style={{ fontSize: 11.5, color: "var(--muted)", textAlign: "center", marginBottom: 24 }}>Cliquez sur un pays pour voir le prochain départ</div>

        {isMobile ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
            {destinations.map((c) => (
              <button key={c.code} onClick={() => setSelectedPays(c.code)} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 14px", textAlign: "center", cursor: "pointer" }}>
                <div style={{ fontSize: 26, marginBottom: 6 }}>{FLAGS[c.code]}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{c.name}</div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>{c.city}</div>
              </button>
            ))}
          </div>
        ) : (
          <div className="bde-ring" style={{ position: "relative", width: 380, height: 380, margin: "0 auto", borderRadius: "50%", border: "2px dashed var(--border)" }}>
            <div className="bde-package-center" style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 76, height: 76, borderRadius: "50%", background: "linear-gradient(135deg,#0A2647,#131A6B)", display: "grid", placeItems: "center", boxShadow: "0 10px 28px rgba(10,38,71,0.35)" }}>
              <Package size={32} color="#fff" />
            </div>
            {destinations.map((c, i) => {
              const angle = (360 / destinations.length) * i;
              const rad = (angle * Math.PI) / 180;
              const radius = 155;
              const x = radius * Math.sin(rad);
              const y = -radius * Math.cos(rad);
              return (
                <div key={c.code} style={{ position: "absolute", top: `calc(50% + ${y}px)`, left: `calc(50% + ${x}px)`, transform: "translate(-50%,-50%)" }}>
                  <div className="bde-ring-item-inner">
                    <button onClick={() => setSelectedPays(c.code)} title={c.name} style={{ width: 68, height: 68, borderRadius: "50%", background: "var(--surface)", border: "1px solid var(--border)", cursor: "pointer", display: "grid", placeItems: "center", fontSize: 28, boxShadow: "0 4px 14px rgba(0,0,0,0.15)" }}>
                      {FLAGS[c.code]}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedCountry && (
        <Modal onClose={() => setSelectedPays(null)} title={`${FLAGS[selectedCountry.code]} ${selectedCountry.name}`}>
          <div style={{ textAlign: "center", padding: "6px 0 4px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", letterSpacing: 0.5, marginBottom: 6 }}>PROCHAIN DÉPART</div>
            {selectedDep.prochaine ? (
              <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 22, fontWeight: 700, color: "var(--text)", marginBottom: 4, textTransform: "capitalize" }}>
                {new Date(selectedDep.prochaine).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
              </div>
            ) : (
              <div style={{ fontSize: 14, color: "var(--muted)", marginBottom: 4 }}>À confirmer — contactez-nous</div>
            )}
            {selectedDep.frequence && <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 14 }}>{selectedDep.frequence}</div>}
            <div style={{ background: "var(--surface2)", borderRadius: 12, padding: 14, marginTop: 10 }}>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>Délai estimé (aérien)</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{selectedCountry.delayAir} jours</div>
            </div>
          </div>
        </Modal>
      )}

      <div style={{ textAlign: "center", padding: "20px 24px", borderTop: "1px solid var(--border)", fontSize: 11.5, color: "var(--muted)" }}>
        {nomPublic} — Transport de colis Conakry - Monde
        <span style={{ margin: "0 8px" }}>·</span>
        <button onClick={() => { window.location.href = "?cgu=1"; }} style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 11.5, textDecoration: "underline", cursor: "pointer", padding: 0 }}>Conditions générales & confidentialité</button>
      </div>
    </div>
  );
}


function Login({ users, onLogin, offline, theme, onToggleTheme, onBackToHome }) {
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [pending, setPending] = useState(null);
  const [otp, setOtp] = useState("");
  const [otpInput, setOtpInput] = useState("");
  const [showPw, setShowPw] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    try {
      const list = users || [];
      const u = list.find((x) => x.identifiant === id.trim());
      if (!u) { setErr("Identifiant ou mot de passe incorrect."); return; }
      const { ok, migratedUser } = await verifyPassword(pw, u);
      if (!ok) { setErr("Identifiant ou mot de passe incorrect."); return; }
      const finalUser = migratedUser || u;
      if (finalUser.twoFA) { const code = genOtp(); setOtp(code); setPending(finalUser); }
      else onLogin(finalUser);
    } catch (ex) {
      console.error(ex);
      setErr("Erreur technique : " + ex.message);
    }
  }
  function verifyOtp(e) {
    e.preventDefault();
    if (otpInput === otp) onLogin(pending);
    else setErr("Code de vérification incorrect.");
  }

  if (pending) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "linear-gradient(135deg,#0A2647 0%,#0A2647 55%,#C8102E 250%)" }}>
        <div style={{ width: "min(92vw, 380px)", background: "var(--surface)", borderRadius: 14, padding: "34px 32px", boxShadow: "0 24px 60px rgba(10,38,71,0.35)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}><ShieldCheck size={18} color="var(--brand-on-dark)" /><div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, color: "var(--text)" }}>Double authentification</div></div>
          <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 14 }}>Démo : aucune passerelle SMS n’étant connectée, votre code de vérification est affiché ci-dessous.</div>
          <div style={{ background: "var(--surface2)", borderRadius: 12, padding: "12px 16px", textAlign: "center", fontFamily: "'Space Grotesk',sans-serif", fontSize: 24, letterSpacing: 4, color: "var(--text)", marginBottom: 14 }}>{otp}</div>
          <div>
            <input value={otpInput} onChange={(e) => setOtpInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && verifyOtp(e)} placeholder="Entrez le code à 6 chiffres" style={{ ...inputStyle, marginBottom: 10, textAlign: "center" }} />
            {err && <div style={{ color: "var(--danger-fg)", fontSize: 12.5, marginBottom: 8 }}>{err}</div>}
            <button type="button" onClick={verifyOtp} style={{ width: "100%", background: "var(--brand-solid)", color: "#fff", border: "none", borderRadius: 8, padding: "11px 0", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Vérifier</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "linear-gradient(135deg,#0A2647 0%,#0A2647 55%,#C8102E 250%)" }}>
      <div style={{ width: "min(92vw, 380px)", background: "var(--surface)", borderRadius: 14, padding: "34px 32px", boxShadow: "0 24px 60px rgba(10,38,71,0.35)", position: "relative" }}>
        {onBackToHome && (
          <button onClick={onBackToHome} style={{ position: "absolute", top: 18, insetInlineStart: 18, display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 12 }}>
            <ChevronLeft size={14} /> Accueil
          </button>
        )}
        {onToggleTheme && (
          <button onClick={onToggleTheme} title="Changer de thème" style={{ position: "absolute", top: 18, insetInlineEnd: 18, width: 30, height: 30, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--text)", cursor: "pointer", display: "grid", placeItems: "center" }}>
            {theme === "dark" ? <Moon size={14} /> : <Sun size={14} />}
          </button>
        )}
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 22, color: "var(--text)" }}>BA-DIABY <span style={{ color: "var(--danger-fg)" }}>EXPRESS</span></div>
          <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 4 }}>Plateforme de gestion logistique</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label style={{ fontSize: 12.5, color: "var(--text)", fontWeight: 600 }}>Identifiant</label>
          <div style={{ display: "flex", alignItems: "center", border: "1.5px solid var(--border)", borderRadius: 8, padding: "9px 12px", gap: 8 }}>
            <User size={15} color="var(--muted)" />
            <input value={id} onChange={(e) => setId(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit(e)} placeholder="Votre identifiant" style={{ border: "none", outline: "none", flex: 1, fontSize: 14, background: "none", color: "var(--text)" }} />
          </div>
          <label style={{ fontSize: 12.5, color: "var(--text)", fontWeight: 600 }}>Mot de passe</label>
          <div style={{ display: "flex", alignItems: "center", border: "1.5px solid var(--border)", borderRadius: 8, padding: "9px 12px", gap: 8 }}>
            <Lock size={15} color="var(--muted)" />
            <input type={showPw ? "text" : "password"} autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit(e)} placeholder="••••••••" style={{ border: "none", outline: "none", flex: 1, fontSize: 14, background: "none", color: "var(--text)" }} />
            <button type="button" onClick={() => setShowPw((s) => !s)} title={showPw ? "Masquer le mot de passe" : "Afficher le mot de passe"} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center" }}>
              {showPw ? <EyeOff size={15} color="var(--muted)" /> : <Eye size={15} color="var(--muted)" />}
            </button>
          </div>
          {err && <div style={{ color: "var(--danger-fg)", fontSize: 12.5 }}>{err}</div>}
          <button type="button" onClick={submit} style={{ marginTop: 6, background: "var(--brand-solid)", color: "#fff", border: "none", borderRadius: 8, padding: "11px 0", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Se connecter</button>
        </div>
        {offline && (
          <div style={{ marginTop: 14, background: "var(--danger-bg)", color: "var(--danger-fg)", borderRadius: 8, padding: "9px 12px", fontSize: 11.5, textAlign: "center" }}>
            Mode local : le stockage n’a pas répondu, vos données ne seront pas sauvegardées entre deux sessions.
          </div>
        )}
      </div>
    </div>
  );
}

const StatCard = memo(function StatCard({ label, value, icon: Icon, tint, trend, trendColor, outline }) {
  return (
    <div style={{ background: SURFACE, borderRadius: 14, padding: "18px 20px", flex: 1, minWidth: 180, border: `1.5px solid ${outline || BORDER}` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 12.5, color: MUTED, fontWeight: 600 }}>{label}</div>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: tint, display: "grid", placeItems: "center" }}><Icon size={16} color="#fff" /></div>
      </div>
      <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 26, fontWeight: 700, color: TEXT, marginTop: 10 }}>{value}</div>
      {trend && <div style={{ fontSize: 11.5, color: trendColor || "var(--ok-fg)", marginTop: 6, fontWeight: 600 }}>{trend}</div>}
    </div>
  );
});

function Dashboard({ data, session, onNavigate, onNouveauColis }) {
  const stats = useMemo(() => {
    const colis = session.agence ? data.colis.filter((c) => (c.site || "Bambeto") === session.agence) : data.colis;
    const total = colis.length;
    const now = new Date();
    const thisMonth = colis.filter((c) => { const d = new Date(c.createdAt); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); }).length;
    const enTransit = colis.filter((c) => c.status === "En transit").length;
    const aExpedier = colis.filter((c) => c.status === "Enregistré").length;
    const ca = colis.reduce((s, c) => s + c.prix, 0);
    const encaisse = colis.reduce((s, c) => s + c.paye, 0);
    const parPays = COUNTRIES.map((p) => ({ ...p, count: colis.filter((c) => c.pays === p.code).length }));
    const recent = [...colis].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
    const parAgence = sitesLocaux(data.sites).map((s) => {
      const colisAgence = colis.filter((c) => (c.site || "Bambeto") === s.nom);
      return { nom: s.nom, count: colisAgence.length, ca: colisAgence.reduce((sum, c) => sum + c.prix, 0) };
    });
    // Colis "oubliés" : toujours au statut Enregistré après plus de 3 jours — signe qu’ils ont
    // été perdus de vue avant même de commencer leur acheminement.
    const oublies = colis.filter((c) => c.status === "Enregistré" && (now - new Date(c.createdAt)) / 86400000 > 3)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const parProvenance = VENDEURS_EN_LIGNE.map((v) => ({ nom: v, count: colis.filter((c) => c.provenance === v).length })).filter((p) => p.count > 0);
    /*
     * Rentabilité par route (pays + sens).
     *
     * La marge retenue est le chiffre d'affaires diminué des commissions d'agence, seul coût
     * rattachable à un colis précis. Les frais de transport, de douane et les charges fixes ne
     * sont pas suivis par colis dans l'application : ils sont donc ABSENTS de ce calcul.
     * C'est une marge avant frais d'acheminement, utile pour comparer les routes entre elles —
     * pas un résultat net. L'écran le précise, pour ne pas laisser croire à autre chose.
     *
     * Le prix au kilo est ce qui permet vraiment de comparer : une route qui rapporte beaucoup
     * en volume peut être moins intéressante au kilo qu'une autre plus modeste.
     */
    const routeMap = {};
    colis.forEach((c) => {
      const key = `${c.pays}|${c.direction}`;
      if (!routeMap[key]) routeMap[key] = { pays: c.pays, direction: c.direction, count: 0, ca: 0, poids: 0, commissions: 0 };
      routeMap[key].count++;
      routeMap[key].ca += c.prix;
      routeMap[key].poids += Number(c.poids) || 0;
      routeMap[key].commissions += calcCommission(c, data.commissionConfig, data.categories);
    });
    const parRoute = Object.values(routeMap).map((r) => ({
      ...r,
      marge: +(r.ca - r.commissions).toFixed(2),
      caParKg: r.poids > 0 ? +(r.ca / r.poids).toFixed(2) : 0,
      margeParKg: r.poids > 0 ? +((r.ca - r.commissions) / r.poids).toFixed(2) : 0,
    })).sort((a, b) => b.marge - a.marge);
    // Widget "À faire aujourd’hui" — regroupe en un seul endroit trois choses qui vivent sur
    // des pages différentes (colis oubliés ici, impayés dans Paiements, demandes dans le
    // Centre clients), pour ne plus avoir à vérifier trois pages séparément chaque matin.
    const impayesARelancer = colis.filter((c) => c.reste > 0 && c.status !== "Annulé" && (now - new Date(c.createdAt)) / 86400000 > 5).length;
    const centreClientsEnAttente = (data.clientAccounts || []).filter((c) => (c.messages || []).some((m) => m.expediteur === "client" && !m.lu)).length
      + (data.preAlertes || []).filter((p) => p.statut === "En attente").length
      + (data.demandesRegroupement || []).filter((r) => r.statut === "En attente").length
      + data.colis.reduce((s, c) => s + (c.signalements || []).filter((sig) => sig.statut === "Ouvert").length, 0)
      + data.colis.filter((c) => c.demandeExpress && c.demandeExpress.statut === "En attente").length;
    return { colis, total, thisMonth, enTransit, aExpedier, ca, encaisse, parPays, recent, parAgence, oublies, parProvenance, parRoute, impayesARelancer, centreClientsEnAttente };
  }, [data.colis, data.sites, data.clientAccounts, data.preAlertes, data.demandesRegroupement, session.agence]);
  const { colis, total, thisMonth, enTransit, aExpedier, ca, encaisse, parPays, recent, parAgence, oublies, parProvenance, parRoute, impayesARelancer, centreClientsEnAttente } = stats;

  const quickActions = [
    { label: "Nouveau Colis", desc: "Créer une étiquette pour un client", icon: Plus, tint: "var(--danger-fg)", view: "colis" },
    { label: "Générer un bordereau", desc: "Expéditions maritimes ou aériennes", icon: FileStack, tint: "#3D63FF", view: "bordereaux" },
    { label: "Rechercher un colis", desc: "Par numéro de suivi ou nom", icon: Search, tint: "#16A163", view: "colis" },
    { label: "Consulter les paiements", desc: "Transactions et factures", icon: Receipt, tint: "#B8801C", view: "paiements" },
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 22 }}>
        <div>
          <h1 style={{ fontFamily: "'Space Grotesk',sans-serif", color: "var(--text)", fontSize: 24, margin: 0 }}>{salutationSelonHeure()}, {(session?.prenom || "").toUpperCase() || "—"}</h1>
          <p style={{ color: "var(--muted)", fontSize: 13.5, margin: "4px 0 0" }}>Voici un aperçu de votre activité logistique</p>
          <p style={{ color: "var(--muted)", fontSize: 12.5, margin: "4px 0 0" }}>📍 Envoi de GUINÉE vers plusieurs destinations 🇬🇳</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => onNavigate("admin")} style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--surface)", color: "var(--text)", border: "1.5px solid var(--border)", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}><Settings size={14} /> Configuration</button>
          <button onClick={() => onNavigate("colis")} style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--brand-solid)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}><Plus size={14} /> Nouveau Colis</button>
        </div>
      </div>

      {(oublies.length > 0 || impayesARelancer > 0 || centreClientsEnAttente > 0) && (
        <div style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderInlineStart: "4px solid var(--brand-solid)",
                      borderRadius: 14, padding: "16px 20px", marginBottom: 20, display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap",
                      boxShadow: "0 2px 10px rgba(0,0,0,0.10)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text)", fontWeight: 700, fontSize: 13.5, flexShrink: 0 }}>
            <Bell size={16} color="var(--brand-on-dark)" /> À faire aujourd’hui
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {oublies.length > 0 && (
              <button onClick={() => onNavigate("colis")} style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--danger-bg)", border: "1px solid var(--danger-border)", borderRadius: 20, padding: "6px 13px", color: "var(--danger-fg)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                <AlertTriangle size={12} /> {oublies.length} colis oublié{oublies.length > 1 ? "s" : ""}
              </button>
            )}
            {impayesARelancer > 0 && (
              <button onClick={() => onNavigate("paiements")} style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--warn-bg)", border: "1px solid var(--warn-border)", borderRadius: 20, padding: "6px 13px", color: "var(--warn-fg)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                <DollarSign size={12} /> {impayesARelancer} impayé{impayesARelancer > 1 ? "s" : ""} à relancer
              </button>
            )}
            {centreClientsEnAttente > 0 && (
              <button onClick={() => onNavigate("centreclients")} style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--info-bg)", border: "1px solid var(--info-border)", borderRadius: 20, padding: "6px 13px", color: "var(--info-fg)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                <MessageCircle size={12} /> {centreClientsEnAttente} demande{centreClientsEnAttente > 1 ? "s" : ""} client{centreClientsEnAttente > 1 ? "s" : ""}
              </button>
            )}
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
        <StatCard label="Volume total" value={total} icon={Package} tint="#3D63FF" trend={`+${thisMonth} ce mois`} trendColor="var(--ok-fg)" />
        <StatCard label="Revenus" value={fmt(ca, "EUR")} icon={DollarSign} tint="#16A163" trend={`${fmt(encaisse, "EUR")} encaissés`} trendColor="var(--ok-fg)" outline="#1E4430" />
        <StatCard label="En transit" value={enTransit} icon={Plane} tint="#5B8DEF" trend="Actuellement en cours" trendColor="var(--muted)" />
        <StatCard label="À expédier" value={aExpedier} icon={AlertTriangle} tint="var(--danger-fg)" trend={aExpedier > 0 ? "Nécessite action" : "Rien en attente"} trendColor={aExpedier > 0 ? "var(--danger-fg)" : "var(--muted)"} />
      </div>

      {oublies.length > 0 && (
        <div style={{ background: "var(--danger-bg)", border: "1px solid var(--danger-border)", borderRadius: 14, padding: "16px 20px", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <AlertTriangle size={17} color="var(--danger-fg)" />
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--danger-fg-soft)" }}>{oublies.length} colis oublié{oublies.length > 1 ? "s" : ""} — toujours "Enregistré" depuis plus de 3 jours</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {oublies.slice(0, 6).map((c) => {
              const jours = Math.floor((new Date() - new Date(c.createdAt)) / 86400000);
              return (
                <button key={c.tracking} onClick={() => onNavigate?.("colis")} style={{ display: "flex", justifyContent: "space-between", background: "none", border: "none", cursor: "pointer", padding: "4px 0", textAlign: "start" }}>
                  <span style={{ fontSize: 12.5, color: "var(--text)" }}>{c.tracking} — {c.destinataire}</span>
                  <span style={{ fontSize: 11.5, color: "var(--danger-fg-soft)" }}>{jours} jours</span>
                </button>
              );
            })}
            {oublies.length > 6 && <div style={{ fontSize: 11.5, color: "var(--danger-fg-soft)" }}>+ {oublies.length - 6} autres</div>}
          </div>
        </div>
      )}

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 20, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontWeight: 700, color: "var(--text)", fontSize: 14.5 }}>Opérations fréquentes</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
          {quickActions.map((a) => (
            <button key={a.label} onClick={() => onNavigate(a.view)} style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px", cursor: "pointer", textAlign: "start" }}>
              <div style={{ width: 38, height: 38, borderRadius: 12, background: a.tint, display: "grid", placeItems: "center", flexShrink: 0 }}><a.icon size={17} color="#fff" /></div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)" }}>{a.label}</div>
                <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{a.desc}</div>
              </div>
              <ChevronRight size={16} color="var(--muted)" />
            </button>
          ))}
        </div>
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 20, marginBottom: 20 }}>
        <div style={{ fontWeight: 700, color: "var(--text)", fontSize: 14.5, marginBottom: 12 }}>Répartition par destination</div>
        {parPays.map((p) => (
          <div key={p.code} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
            <div style={{ width: 130, fontSize: 13, color: "var(--text)" }}>{FLAGS[p.code]} {p.name}</div>
            <div style={{ flex: 1, height: 8, background: "var(--surface2)", borderRadius: 6, overflow: "hidden" }}>
              <div style={{ width: `${total ? (p.count / total) * 100 : 0}%`, height: "100%", background: "var(--brand-solid)" }} />
            </div>
            <div style={{ width: 24, textAlign: "right", fontSize: 13, color: "var(--muted)" }}>{p.count}</div>
          </div>
        ))}
        {total === 0 && <div style={{ color: "var(--muted)", fontSize: 13 }}>Aucun colis enregistré pour le moment.</div>}
      </div>

      {parProvenance.length > 0 && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 20, marginBottom: 20 }}>
          <div style={{ fontWeight: 700, color: "var(--text)", fontSize: 14.5, marginBottom: 12 }}>Répartition par site d’achat</div>
          {parProvenance.sort((a, b) => b.count - a.count).map((p) => (
            <div key={p.nom} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <div style={{ width: 130, fontSize: 13, color: "var(--text)" }}>{p.nom}</div>
              <div style={{ flex: 1, height: 8, background: "var(--surface2)", borderRadius: 6, overflow: "hidden" }}>
                <div style={{ width: `${total ? (p.count / total) * 100 : 0}%`, height: "100%", background: "#5B8DEF" }} />
              </div>
              <div style={{ width: 24, textAlign: "right", fontSize: 13, color: "var(--muted)" }}>{p.count}</div>
            </div>
          ))}
        </div>
      )}

      {parAgence.length > 0 && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 20, marginBottom: 20 }}>
          <div style={{ fontWeight: 700, color: "var(--text)", fontSize: 14.5, marginBottom: 12 }}>Statistiques par agence</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
            {parAgence.map((a) => (
              <div key={a.nom} style={{ background: "var(--surface2)", borderRadius: 12, padding: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{a.nom}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", fontFamily: "'Space Grotesk',sans-serif", marginTop: 4 }}>{a.count}</div>
                <div style={{ fontSize: 11.5, color: "var(--muted)" }}>colis · {fmt(a.ca, "EUR")}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {parRoute.length > 0 && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 20, marginBottom: 20 }}>
          <div style={{ fontWeight: 700, color: "var(--text)", fontSize: 14.5, marginBottom: 2 }}>Rentabilité par route</div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 12, lineHeight: 1.5 }}>Marge = prix facturé moins les commissions d’agence. Les frais de transport, de douane et les charges fixes ne sont pas suivis par colis : ce n’est donc pas un résultat net, mais une base fiable pour comparer les routes entre elles.</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ textAlign: "start", color: "var(--muted)", borderBottom: "1px solid var(--border)" }}>
                  <th style={{ padding: "0 8px 8px 0", fontWeight: 600 }}>Route</th>
                  <th style={{ padding: "0 8px 8px 0", fontWeight: 600 }}>Colis</th>
                  <th style={{ padding: "0 8px 8px 0", fontWeight: 600 }}>Poids total</th>
                  <th style={{ padding: "0 8px 8px 0", fontWeight: 600 }}>CA</th>
                  <th style={{ padding: "0 8px 8px 0", fontWeight: 600 }}>Commissions</th>
                    <th style={{ padding: "0 8px 8px 0", fontWeight: 600 }}>Marge</th>
                    <th style={{ padding: "0 0 8px 0", fontWeight: 600 }}>Marge / kg</th>
                </tr>
              </thead>
              <tbody>
                {parRoute.map((r) => (
                  <tr key={`${r.pays}-${r.direction}`} style={{ borderBottom: "1px solid var(--surface2)" }}>
                    <td style={{ padding: "8px 8px 8px 0", color: "var(--text)", fontWeight: 600 }}>{FLAGS[r.pays] || ""} {routeLabel(r.pays, r.direction)}</td>
                    <td style={{ padding: "8px 8px 8px 0", color: "var(--text)" }}>{r.count}</td>
                    <td style={{ padding: "8px 8px 8px 0", color: "var(--text)" }}>{r.poids.toFixed(1)} kg</td>
                    <td style={{ padding: "8px 8px 8px 0", color: "var(--text)" }}>{fmt(r.ca, "EUR")}</td>
                    <td style={{ padding: "8px 8px 8px 0", color: "var(--muted)" }}>-{fmt(r.commissions, "EUR")}</td>
                      <td style={{ padding: "8px 8px 8px 0", fontWeight: 700, color: r.marge >= 0 ? "var(--ok-fg)" : "var(--danger-fg)" }}>{fmt(r.marge, "EUR")}</td>
                      <td style={{ padding: "8px 0", fontWeight: 600, color: r.margeParKg >= 0 ? "var(--text)" : "var(--danger-fg)" }}>{r.poids > 0 ? fmt(r.margeParKg, "EUR") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontWeight: 700, color: "var(--text)", fontSize: 14.5 }}>Activité récente</div>
          {total > 0 && <button onClick={() => onNavigate("colis")} style={{ background: "none", border: "none", color: "var(--info-fg)", fontSize: 12.5, cursor: "pointer" }}>Voir tout</button>}
        </div>
        {recent.length === 0 ? (
          <div style={{ textAlign: "center", padding: "30px 0", color: "var(--muted)", fontSize: 13 }}>
            Aucune activité pour le moment.<br />Les nouveaux colis apparaîtront ici.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {recent.map((c) => {
              const st = STATUS_STYLE[c.status];
              return (
                <div key={c.tracking} onClick={() => onNavigate("colis")} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 4px", borderBottom: "1px solid var(--surface2)", cursor: "pointer" }}>
                  <div>
                    <div style={{ fontSize: 13, color: "var(--text)", fontWeight: 600 }}>{c.tracking} · {c.destinataire}</div>
                    <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{routeLabel(c.pays, c.direction)}</div>
                  </div>
                  <span style={{ background: st.bg, color: st.fg, padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{c.status}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}


Dashboard = memo(Dashboard);
function PartnerDashboard({ data, session }) {
  const [periode, setPeriode] = useState("mois");
  const colisPartenaire = data.colis.filter((c) => c.partenaireId === session.id);
  const now = new Date();
  const inPeriod = (dateStr) => {
    const d = new Date(dateStr);
    if (periode === "semaine") { const start = new Date(now); start.setDate(now.getDate() - now.getDay()); return d >= start; }
    if (periode === "mois") return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    return true;
  };
  const scoped = colisPartenaire.filter((c) => c.status !== "Annulé" && inPeriod(c.createdAt));
  const poidsTotal = scoped.reduce((s, c) => s + c.poids, 0);
  const commissionTotale = scoped.reduce((s, c) => s + calcCommission(c, data.commissionConfig, data.categories), 0);
  const recus = colisPartenaire.filter((c) => c.paye > 0 && inPeriod(c.createdAt));

  return (
    <div>
      <h1 style={{ fontFamily: "'Space Grotesk',sans-serif", color: "var(--text)", fontSize: 24, margin: "0 0 4px" }}>Espace Partenaire</h1>
      <p style={{ color: "var(--muted)", fontSize: 13.5, marginTop: 0, marginBottom: 18 }}>Bienvenue {session.prenom} {session.nom} — suivi de vos colis et de vos commissions.</p>

      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        {[["semaine", "Cette semaine"], ["mois", "Ce mois"], ["tout", "Tout"]].map(([k, label]) => (
          <button key={k} onClick={() => setPeriode(k)} style={{ padding: "7px 14px", borderRadius: 20, border: "1.5px solid " + (periode === k ? "var(--brand-solid)" : "var(--border)"), background: periode === k ? "var(--brand-solid)" : "var(--surface)", color: periode === k ? "#fff" : "var(--muted)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>{label}</button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 14, marginBottom: 24 }}>
        <StatCard label="Colis suivis" value={scoped.length} icon={Package} tint="#3D63FF" />
        <StatCard label="Poids total" value={`${poidsTotal.toFixed(1)} kg`} icon={Truck} tint="#8B5CF6" />
        <StatCard label="Commission gagnée" value={fmt(commissionTotale, "EUR")} icon={DollarSign} tint="#16A163" />
      </div>

      <div style={{ fontWeight: 700, color: "var(--text)", fontSize: 14, marginBottom: 10 }}>Vos colis</div>
      <div style={{ background: "var(--surface)", borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden", marginBottom: 20 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr style={{ background: "var(--surface2)", textAlign: "left" }}>{["N° de suivi", "Destinataire", "Statut", "Poids", "Commission"].map((h) => <th key={h} style={{ padding: "10px 14px", fontSize: 10.5, color: "var(--muted)", fontWeight: 700 }}>{h}</th>)}</tr></thead>
          <tbody>
            {colisPartenaire.length === 0 && <tr><td colSpan={5} style={{ padding: 20, color: "var(--muted)", fontSize: 13 }}>Aucun colis ne vous est encore rattaché.</td></tr>}
            {colisPartenaire.map((c) => {
              const st = STATUS_STYLE[c.status];
              return (
                <tr key={c.tracking} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "10px 14px", fontSize: 12.5, color: "var(--text)", fontWeight: 600 }}>{c.tracking}</td>
                  <td style={{ padding: "10px 14px", fontSize: 12.5, color: "var(--text)" }}>{c.destinataire}</td>
                  <td style={{ padding: "10px 14px" }}><span style={{ background: st?.bg, color: st?.fg, padding: "3px 9px", borderRadius: 20, fontSize: 10.5, fontWeight: 700 }}>{c.status}</span></td>
                  <td style={{ padding: "10px 14px", fontSize: 12.5, color: "var(--muted)" }}>{c.poids} kg</td>
                  <td style={{ padding: "10px 14px", fontSize: 12.5, color: "var(--ok-fg)", fontWeight: 600 }}>{fmt(calcCommission(c, data.commissionConfig, data.categories), "EUR")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ fontWeight: 700, color: "var(--text)", fontSize: 14, marginBottom: 10 }}>Historique des paiements reçus par vos colis</div>
      <div style={{ background: "var(--surface)", borderRadius: 14, border: "1px solid var(--border)", padding: 16 }}>
        {recus.length === 0 ? (
          <div style={{ color: "var(--muted)", fontSize: 13 }}>Aucun paiement enregistré sur cette période.</div>
        ) : recus.flatMap((c) => (c.paiements || []).map((p) => (
          <div key={p.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "var(--text)", padding: "6px 0", borderTop: "1px solid var(--border)" }}>
            <span>{c.tracking} — {p.deviseSaisie ? fmt(p.montant, p.deviseSaisie) : fmt(p.montant, "EUR")}</span>
            <span style={{ color: "var(--muted)" }}>{new Date(p.date).toLocaleDateString("fr-FR")}</span>
          </div>
        )))}
      </div>
    </div>
  );
}

function calcPrice(countryCode, poids, volume, mode) {
  const c = COUNTRIES.find((x) => x.code === countryCode);
  if (!c) return 0;
  const rate = mode === "air" ? c.air : c.sea;
  const volKg = Math.max(Number(poids) || 0, (Number(volume) || 0) * 167);
  return +(5 + volKg * rate).toFixed(2);
}

function ConfigurationHub({ data, persist, session, notify, onNavigateApp, offline }) {
  const [sub, setSub] = useState(null);
  const back = () => setSub(null);

  if (sub === "site") return <SiteVitrinePage data={data} persist={persist} notify={notify} onBack={back} />;
  if (sub === "routes") return <RoutesTarifsPage data={data} persist={persist} session={session} notify={notify} onBack={back} />;
  if (sub === "devises") return <GestionDevisesPage data={data} persist={persist} session={session} notify={notify} onBack={back} />;
  if (sub === "commissions") return <CommissionsPage data={data} persist={persist} session={session} notify={notify} onBack={back} />;
  if (sub === "reception") return <ReceptionTarifsPage data={data} persist={persist} notify={notify} onBack={back} />;
  if (sub === "agences") return <AgencesConfigPage data={data} persist={persist} notify={notify} onBack={back} />;
  if (sub === "guide") return <GuidePage onBack={back} />;
  if (sub === "categories") return <CategoriesProduitsPage data={data} persist={persist} session={session} notify={notify} onBack={back} />;
  if (sub === "sauvegarde") return <SauvegardePage data={data} persist={persist} notify={notify} session={session} onBack={back} />;
  if (sub === "sites") return <SitesOperationPage data={data} persist={persist} notify={notify} onBack={back} />;
  if (sub === "notifwa") return <NotificationsWhatsAppPage data={data} persist={persist} notify={notify} onBack={back} />;
  if (sub === "departs") return <DepartsPage data={data} persist={persist} notify={notify} onBack={back} />;
  if (sub === "paiement") return <PaiementConfigPage data={data} persist={persist} notify={notify} onBack={back} />;
  if (sub === "branding") return <BrandingPage data={data} persist={persist} notify={notify} onBack={back} />;
  if (sub === "users") return <UtilisateursPage data={data} persist={persist} notify={notify} onBack={back} session={session} />;
  if (sub === "performance") return <PerformanceAgentsPage data={data} onBack={back} />;
  if (sub === "systeme") return <ParametresSystemePage data={data} persist={persist} notify={notify} onBack={back} offline={offline} />;
  if (sub === "journal") return <JournalActivitePage data={data} onBack={back} />;

  const Card = ({ icon: Icon, tint, title, desc, onClick }) => (
    <button onClick={onClick} style={{ display: "flex", gap: 14, textAlign: "start", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 18, cursor: "pointer" }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, background: tint, display: "grid", placeItems: "center", flexShrink: 0 }}><Icon size={18} color="#fff" /></div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{title}</div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4, lineHeight: 1.4 }}>{desc}</div>
      </div>
    </button>
  );
  const SectionLabel = ({ children, badge }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "22px 0 10px" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", letterSpacing: 0.5 }}>{children}</div>
      {badge && <span style={{ background: "#3D63FF", color: "#fff", fontSize: 9.5, fontWeight: 700, padding: "2px 7px", borderRadius: 6 }}>{badge}</span>}
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: "'Space Grotesk',sans-serif", color: "var(--text)", fontSize: 24, margin: 0 }}>Configuration</h1>
          <p style={{ color: "var(--muted)", fontSize: 13.5, margin: "4px 0 0" }}>Gérez les paramètres globaux de votre plateforme logistique.</p>
        </div>
        <button onClick={() => onNavigateApp("dashboard")} style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 14px", color: "var(--text)", fontSize: 12.5, cursor: "pointer", flexShrink: 0 }}>
          <LayoutDashboard size={14} /> Retour Dashboard
        </button>
      </div>

      <SectionLabel badge="NOUVEAU">CANAUX DE VENTE</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14 }}>
        <Card icon={Globe} tint="#3D63FF" title="Site Vitrine Public" desc="Personnalisez votre page d’accueil, activez le tracking public et configurez votre nom de domaine." onClick={() => setSub("site")} />
      </div>

      <SectionLabel>COMMERCIAL &amp; LOGISTIQUE</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 14 }}>
        <Card icon={DollarSign} tint="#8B5CF6" title="Routes &amp; Tarifs" desc="Gérer les taux de change, prix par kg et destinations." onClick={() => setSub("routes")} />
        <Card icon={RefreshCw} tint="#0EA5E9" title="Gestion des devises" desc="Un taux par devise, partagé automatiquement par tous les pays concernés." onClick={() => setSub("devises")} />
        <Card icon={Users} tint="#16A163" title="Commissions par Agence" desc="Définissez combien chaque agence gagne par kg et par unité vendue." onClick={() => setSub("commissions")} />
        <Card icon={Package} tint="var(--danger-fg)" title="Tarifs de réception client" desc="Le tarif au kg appliqué sur les bordereaux de réception, selon le poids du lot." onClick={() => setSub("reception")} />
        <Card icon={MapPin} tint="#5B8DEF" title="Siège & agences de réception" desc="Coordonnées de l’entreprise et des agences à l’étranger, affichées automatiquement sur le ticket d’envoi." onClick={() => setSub("agences")} />
        <Card icon={Sparkles} tint="#8B5CF6" title="Guide d’utilisation" desc="Explications des fonctionnalités récentes : comptes clients, pré-alertes, bordereau de réception, tarifs par palier..." onClick={() => setSub("guide")} />
        <Card icon={Receipt} tint="#E0794E" title="Catégories de Produits" desc="Configuration des types de marchandises et taxes." onClick={() => setSub("categories")} />
        <Card icon={Download} tint="var(--danger-fg)" title="Sauvegarde des données" desc="Téléchargez une copie complète de votre plateforme. Le seul filet en cas de perte." onClick={() => setSub("sauvegarde")} />
        <Card icon={Plane} tint="#5B8DEF" title="Calendrier des départs" desc="Annoncez quand part le prochain envoi : vos clients cessent d’appeler pour le demander." onClick={() => setSub("departs")} />
        <Card icon={MessageCircle} tint="#16A163" title="Notifications clients" desc="Qui est prévenu automatiquement, et pour quel événement — par WhatsApp et par e-mail." onClick={() => setSub("notifwa")} />
        <Card icon={MapPin} tint="#16A163" title="Sites d’opération" desc="Gérez vos points d’enregistrement et de retrait, et les informations affichées sur le ticket d’envoi (horaires, paiements, stockage...)." onClick={() => setSub("sites")} />
        <Card icon={Receipt} tint="#5B8DEF" title="Paiement" desc="Configurez vos numéros pour accepter les paiements de vos clients." onClick={() => setSub("paiement")} />
      </div>

      <SectionLabel>ADMINISTRATION</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 14 }}>
        <Card icon={ShieldCheck} tint="var(--danger-fg)" title="Branding &amp; Identité" desc="Logo, textes légaux et personnalisation de l’identité." onClick={() => setSub("branding")} />
        <Card icon={Users} tint="#6366F1" title="Gestion Utilisateurs" desc="Accès, rôles et permissions de l’équipe." onClick={() => setSub("users")} />
        <Card icon={LayoutDashboard} tint="#3D63FF" title="Performance des agents" desc="Colis enregistrés, chiffre d’affaires et paiements encaissés, par agent." onClick={() => setSub("performance")} />
        <Card icon={Settings} tint="#6B7280" title="Paramètres Système" desc="Options avancées de la plateforme." onClick={() => setSub("systeme")} />
        <Card icon={FileStack} tint="#5B8DEF" title="Journal d’activité" desc="Historique complet des actions effectuées par les utilisateurs." onClick={() => setSub("journal")} />
      </div>
    </div>
  );
}


function ConfigPageHeader({ title, desc, onBack }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 22 }}>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", color: "var(--text)", fontSize: 12.5, cursor: "pointer", flexShrink: 0, marginTop: 2 }}>
        <ChevronLeft size={14} /> Configuration
      </button>
      <div>
        <h1 style={{ fontFamily: "'Space Grotesk',sans-serif", color: "var(--text)", fontSize: 22, margin: 0 }}>{title}</h1>
        <p style={{ color: "var(--muted)", fontSize: 13, margin: "4px 0 0" }}>{desc}</p>
      </div>
    </div>
  );
}

function RoutesTarifsPage({ data, persist, session, notify, onBack }) {
  const [pays, setPays] = useState("FR");
  const [poids, setPoids] = useState("5");
  const [mode, setMode] = useState("air");
  const [cur, setCur] = useState("EUR");
  const prix = calcPrice(pays, poids, "", mode);
  const dest = COUNTRIES.find((c) => c.code === pays);

  return (
    <div>
      <ConfigPageHeader title="Routes & Tarifs" desc="Simulateur de tarif d’expédition par destination et mode de transport." onBack={onBack} />

      <div style={{ background: "linear-gradient(135deg, #131A6B, #0A1740)", borderRadius: 14, padding: "20px 22px", marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 18, fontWeight: 700, color: "#fff" }}>Routes & Tarifs</div>
          <div style={{ fontSize: 12.5, color: "var(--neutral-fg)", marginTop: 4 }}>Les taux de change sont désormais gérés par devise, pas par route — voir "Gestion des devises".</div>
        </div>
        <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: 8, padding: "8px 14px", fontSize: 12, color: "#fff" }}>
          Module Maritime : <strong style={{ color: "#FF8A9B" }}>DÉSACTIVÉ</strong>
        </div>
      </div>

      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        <div style={{ background: "var(--surface)", borderRadius: 14, padding: 22, width: "min(92vw, 340px)", border: "1px solid var(--border)" }}>
          <Field label="Pays de destination"><select value={pays} onChange={(e) => setPays(e.target.value)} style={inputStyle}>{COUNTRIES.filter(c => c.code !== "GN").map((c) => <option key={c.code} value={c.code}>{FLAGS[c.code]} {c.name} — {c.city}</option>)}</select></Field>
          <Field label="Poids (kg)"><input value={poids} onChange={(e) => setPoids(e.target.value)} style={inputStyle} /></Field>
          <Field label="Mode de transport">
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setMode("air")} style={{ ...toggleBtn, ...(mode === "air" ? toggleActive : {}) }}><Plane size={14} /> Aérien</button>
              <button disabled title="Voie maritime temporairement indisponible" style={{ ...toggleBtn, opacity: 0.4, cursor: "not-allowed" }}><Ship size={14} /> Maritime</button>
            </div>
          </Field>
          <Field label="Devise d’affichage"><select value={cur} onChange={(e) => setCur(e.target.value)} style={inputStyle}>{Object.keys(data?.exchangeRates || CURRENCIES).map((c) => <option key={c} value={c}>{c}</option>)}</select></Field>
        </div>
        <div style={{ background: "#0A2647", borderRadius: 14, padding: 26, width: 260, color: "#fff", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
          <div style={{ fontSize: 12.5, color: "var(--muted)" }}>Tarif estimé</div>
          <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 30, fontWeight: 700, marginTop: 6, color: "#fff" }}>{fmt(prix, cur)}</div>
          <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 8, textAlign: "center" }}>Conakry → {dest?.city} · {mode === "air" ? "Aérien" : "Maritime"} · devise {dest?.currency}</div>
        </div>
      </div>
    </div>
  );
}

function GuidePage({ onBack }) {
  const [ouvert, setOuvert] = useState(null);
  const sections = [
    {
      titre: "Compte client & Espace Client",
      contenu: [
        "Chaque client peut créer son propre compte (identifiant + mot de passe) via le lien \"Espace Client\" sur la page d’accueil publique.",
        "Pour rattacher un colis à un client déjà inscrit : à l’étape \"Frais\" de la création d’un colis, utilisez le champ \"Rattacher à un compte client\" et recherchez par le nom écrit sur le colis.",
        "Une fois rattaché, le client voit ce colis, son statut, et peut télécharger sa facture depuis son espace — sans que vous ayez besoin de le lui envoyer manuellement.",
      ],
    },
    {
      titre: "Pré-alertes",
      contenu: [
          "Un client peut annoncer à l’avance une commande qu’il attend (ex : Shein), avec sa référence de commande. Il n’indique pas de poids : c’est vous qui pesez à l’arrivée.",
          "Retrouvez toutes les annonces dans Centre clients → Pré-alertes (le badge indique le nombre en attente).",
          "À l’arrivée du colis, cliquez sur \"Réceptionner & peser\" : vous corrigez les informations si besoin, vous saisissez le poids réel, et le prix se calcule automatiquement selon vos paliers. La validation crée le colis au nom du client, qui le voit aussitôt dans son espace.",
      ],
    },
    {
      titre: "Bordereau de réception & tarifs par palier",
      contenu: [
        "Quand des colis sont arrivés et prêts à être récupérés par un client, utilisez \"Bordereau de réception\" (dans Colis).",
        "Recherchez le client, sélectionnez les colis disponibles (statut \"Arrivé\"), le tarif au kg s’applique automatiquement selon le poids total du lot.",
        "Vous pouvez aussi enregistrer directement un colis tout juste arrivé (identifié par une référence ou un nom) sans repasser par le formulaire complet, via le bouton \"+ Enregistrer un colis reçu\".",
        "Les paliers de tarification (GNF/kg selon le poids) se règlent dans Configuration → Tarifs de réception client.",
      ],
    },
    {
      titre: "Documents & impressions",
      contenu: [
        "Étiquette QR (100×150mm) : à coller sur le colis. N’affiche jamais de montant.",
        "Ticket d’envoi (A4) et Ticket thermique (80mm) : reçus complets pour le client, avec les montants.",
        "Bordereau : liste de colis groupés pour un même trajet, avec suivi de statut en 5 étapes (Brouillon → Livré).",
      ],
    },
    {
      titre: "Mode hors-ligne (site déployé uniquement)",
      contenu: [
        "Si la connexion internet coupe, vous pouvez continuer à travailler normalement — une bannière rouge l’indique.",
        "Dès que la connexion revient, tout se synchronise automatiquement, sans action de votre part.",
      ],
    },
    {
      titre: "Suivi public & confidentialité",
      contenu: [
        "Le lien \"Suivi public\" (sur chaque colis) peut être partagé avec n’importe qui : il ne montre jamais les montants, seulement le statut.",
        "Le numéro de téléphone doit toujours inclure l’indicatif du pays (le sélecteur s’en charge automatiquement) — sinon les recherches par téléphone ne fonctionneront pas.",
      ],
    },
  ];

  return (
    <div>
      <ConfigPageHeader title="Guide d’utilisation" desc="Explications rapides des fonctionnalités les plus récentes." onBack={onBack} />
      <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 700 }}>
        {sections.map((s, i) => (
          <div key={i} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
            <button onClick={() => setOuvert(ouvert === i ? null : i)} style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", background: "none", border: "none", cursor: "pointer", textAlign: "start" }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{s.titre}</span>
              <ChevronRight size={16} color="var(--muted)" style={{ transform: ouvert === i ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s" }} />
            </button>
            {ouvert === i && (
              <div style={{ padding: "0 18px 16px" }}>
                {s.contenu.map((p, j) => (
                  <div key={j} style={{ display: "flex", gap: 8, fontSize: 12.5, color: "var(--muted)", lineHeight: 1.6, marginBottom: 8 }}>
                    <span style={{ color: "var(--danger-fg)", flexShrink: 0 }}>•</span>{p}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function AgencesConfigPage({ data, persist, notify, onBack }) {
  const [entreprise, setEntreprise] = useState(data.entreprise || { adresseSiege: "", telephone: "", email: "", siteWeb: "" });
  const [agences, setAgences] = useState(data.agencesReception || {});

  function updateAgence(code, key, value) {
    setAgences((a) => ({ ...a, [code]: { ...(a[code] || {}), [key]: value } }));
  }
  function save() {
    persist({ ...data, entreprise, agencesReception: agences });
    notify?.("Coordonnées mises à jour");
  }

  return (
    <div>
      <ConfigPageHeader title="Siège & agences de réception" desc="Ces coordonnées s’affichent automatiquement sur le ticket d’envoi, selon l’agence d’enregistrement et le pays de destination du colis." onBack={onBack} />

      <div style={{ background: "var(--surface)", borderRadius: 14, padding: 22, maxWidth: 500, border: "1px solid var(--border)", marginBottom: 20 }}>
        <div style={{ fontWeight: 700, color: "var(--text)", fontSize: 14, marginBottom: 14 }}>Siège de l’entreprise</div>
        <Field label="Adresse du siège"><input value={entreprise.adresseSiege} onChange={(e) => setEntreprise({ ...entreprise, adresseSiege: e.target.value })} style={inputStyle} /></Field>
        <Field label="Téléphone"><input value={entreprise.telephone} onChange={(e) => setEntreprise({ ...entreprise, telephone: e.target.value })} style={inputStyle} /></Field>
        <Field label="E-mail"><input value={entreprise.email} onChange={(e) => setEntreprise({ ...entreprise, email: e.target.value })} style={inputStyle} /></Field>
        <Field label="Site web"><input value={entreprise.siteWeb} onChange={(e) => setEntreprise({ ...entreprise, siteWeb: e.target.value })} style={inputStyle} /></Field>
      </div>

      <div style={{ background: "var(--surface)", borderRadius: 14, padding: 22, maxWidth: 620, border: "1px solid var(--border)", marginBottom: 20 }}>
        <div style={{ fontWeight: 700, color: "var(--text)", fontSize: 14, marginBottom: 4 }}>Agences de réception par destination</div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16 }}>Laissez vide pour les pays sans agence physique de réception — rien ne s’affichera sur le ticket dans ce cas.</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {COUNTRIES.filter((c) => c.code !== "GN").map((c) => {
            const a = agences[c.code] || {};
            return (
              <div key={c.code} style={{ background: "var(--surface2)", borderRadius: 12, padding: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>{FLAGS[c.code]} {c.name} — {c.city}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 8 }}>
                  <input value={a.adresse || ""} onChange={(e) => updateAgence(c.code, "adresse", e.target.value)} placeholder="Adresse de l’agence" style={{ ...inputStyle, marginBottom: 0 }} />
                  <input value={a.telephone || ""} onChange={(e) => updateAgence(c.code, "telephone", e.target.value)} placeholder="Téléphone" style={{ ...inputStyle, marginBottom: 0 }} />
                  <input value={a.horaires || ""} onChange={(e) => updateAgence(c.code, "horaires", e.target.value)} placeholder="Horaires" style={{ ...inputStyle, marginBottom: 0 }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <button onClick={save} style={{ background: "#3D63FF", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Enregistrer</button>
    </div>
  );
}

function ReceptionTarifsPage({ data, persist, notify, onBack }) {
  const defautPaliers = [{ max: 10, tarif: 100000 }, { max: 40, tarif: 95000 }, { max: 100, tarif: 92000 }];
  const [paliers, setPaliers] = useState(data.receptionTarifs?.paliers || defautPaliers);
  const [expressTarifEurKg, setExpressTarifEurKg] = useState(data.expressTarifEurKg ?? 12);
  const [remiseVol, setRemiseVol] = useState(data.remiseVolume || { active: false, paliers: [{ minKg: 20, remise: 5 }, { minKg: 50, remise: 10 }, { minKg: 100, remise: 15 }] });

  function updatePalier(i, key, value) {
    setPaliers((list) => list.map((p, idx) => (idx === i ? { ...p, [key]: Number(value) || 0 } : p)));
  }
  function ajouterPalier() {
    const dernier = paliers[paliers.length - 1];
    setPaliers((list) => [...list, { max: (dernier?.max || 0) + 20, tarif: Math.max(0, (dernier?.tarif || 0) - 3000) }]);
  }
  function retirerPalier(i) {
    setPaliers((list) => list.filter((_, idx) => idx !== i));
  }

  function save() {
    const sorted = [...paliers].sort((a, b) => a.max - b.max);
    const volTries = { ...remiseVol, paliers: [...(remiseVol.paliers || [])].sort((a, b) => a.minKg - b.minKg) };
    persist({ ...data, receptionTarifs: { paliers: sorted }, expressTarifEurKg: Number(expressTarifEurKg) || 0, remiseVolume: volTries });
    notify?.("Tarifs mis à jour");
  }

  const sortedPreview = [...paliers].sort((a, b) => a.max - b.max);

  return (
    <div>
      <ConfigPageHeader title="Tarifs de réception & livraison express" desc="Tarif au kg par paliers pour le bordereau de réception, et le tarif de la livraison express demandée par les clients." onBack={onBack} />

      <div style={{ background: "var(--surface)", borderRadius: 14, padding: 22, maxWidth: 560, border: "1px solid var(--border)", marginBottom: 20 }}>
        <div style={{ fontWeight: 700, color: "var(--text)", fontSize: 14, marginBottom: 4 }}>Paliers de réception (GNF / kg)</div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16 }}>Le poids total du lot sélectionné détermine le palier appliqué à l’ensemble du lot.</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
          {paliers.map((p, i) => {
            const min = i === 0 ? 1 : (sortedPreview[sortedPreview.indexOf(p)] ? sortedPreview[Math.max(0, sortedPreview.indexOf(p) - 1)]?.max + 1 : "");
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--surface2)", borderRadius: 8, padding: "9px 12px" }}>
                <span style={{ fontSize: 12, color: "var(--muted)", width: 60, flexShrink: 0 }}>Jusqu’à</span>
                <input type="number" value={p.max} onChange={(e) => updatePalier(i, "max", e.target.value)} style={{ ...inputStyle, width: 80, marginBottom: 0 }} />
                <span style={{ fontSize: 12, color: "var(--muted)" }}>kg →</span>
                <input type="number" value={p.tarif} onChange={(e) => updatePalier(i, "tarif", e.target.value)} style={{ ...inputStyle, width: 110, marginBottom: 0 }} />
                <span style={{ fontSize: 12, color: "var(--muted)" }}>GNF/kg</span>
                {paliers.length > 1 && <button onClick={() => retirerPalier(i)} style={{ marginInlineStart: "auto", background: "none", border: "none", color: "var(--danger-fg)", cursor: "pointer" }}><X size={15} /></button>}
              </div>
            );
          })}
        </div>
        <button onClick={ajouterPalier} style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 14px", fontSize: 12, color: "var(--text)", cursor: "pointer", marginBottom: 14 }}>+ Ajouter un palier</button>
        <div style={{ background: "var(--surface2)", borderRadius: 8, padding: "10px 12px", fontSize: 11.5, color: "var(--muted)" }}>
          {sortedPreview.map((p, i) => {
            const prevMax = i === 0 ? 1 : sortedPreview[i - 1].max + 1;
            return <div key={i}>De {prevMax} à {p.max} kg : {p.tarif.toLocaleString("fr-FR")} GNF/kg</div>;
          })}
          <div>Au-delà de {sortedPreview[sortedPreview.length - 1]?.max} kg : {sortedPreview[sortedPreview.length - 1]?.tarif.toLocaleString("fr-FR")} GNF/kg (dernier palier)</div>
        </div>
      </div>

      <div style={{ background: "var(--surface)", borderRadius: 14, padding: 22, maxWidth: 460, border: "1px solid var(--border)", marginBottom: 20 }}>
        <div style={{ fontWeight: 700, color: "var(--text)", fontSize: 14, marginBottom: 4 }}>Livraison express (72h)</div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 14 }}>Tarif que les clients voient dans leur espace pour demander une livraison express sur un de leurs colis.</div>
        <Field label="Tarif (€ / kg)"><input type="number" step="0.5" value={expressTarifEurKg} onChange={(e) => setExpressTarifEurKg(e.target.value)} style={inputStyle} /></Field>
      </div>

      <div style={{ background: "var(--surface)", borderRadius: 14, padding: 22, maxWidth: 560, border: "1px solid var(--border)", marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontWeight: 700, color: "var(--text)", fontSize: 14 }}>Remise sur le volume</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3, lineHeight: 1.5 }}>
              Un gros colis coûte proportionnellement moins cher à traiter : une seule étiquette, un seul
              passage en douane, une seule remise. Cette remise porte sur le poids total et se cumule avec
              la remise fidélité.
            </div>
          </div>
          <button onClick={() => setRemiseVol((r) => ({ ...r, active: !r.active }))} aria-pressed={remiseVol.active}
            style={{ width: 44, height: 24, borderRadius: 20, border: "none", padding: 2, cursor: "pointer", flexShrink: 0,
                     background: remiseVol.active ? "var(--ok-fg)" : "var(--surface2)", display: "flex",
                     justifyContent: remiseVol.active ? "flex-end" : "flex-start" }}>
            <span style={{ width: 20, height: 20, borderRadius: 20, background: "#fff", display: "block" }} />
          </button>
        </div>

        {remiseVol.active && (
          <div style={{ marginTop: 16 }}>
            {(remiseVol.paliers || []).map((pal, idx) => (
              <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12.5, color: "var(--muted)" }}>À partir de</span>
                <input type="number" min="1" value={pal.minKg}
                  onChange={(e) => setRemiseVol((r) => ({ ...r, paliers: r.paliers.map((x, i) => (i === idx ? { ...x, minKg: Number(e.target.value) || 0 } : x)) }))}
                  style={{ ...inputStyle, width: 90, marginBottom: 0 }} />
                <span style={{ fontSize: 12.5, color: "var(--muted)" }}>kg →</span>
                <input type="number" min="0" max="100" value={pal.remise}
                  onChange={(e) => setRemiseVol((r) => ({ ...r, paliers: r.paliers.map((x, i) => (i === idx ? { ...x, remise: Number(e.target.value) || 0 } : x)) }))}
                  style={{ ...inputStyle, width: 80, marginBottom: 0 }} />
                <span style={{ fontSize: 12.5, color: "var(--muted)" }}>% de remise</span>
                {remiseVol.paliers.length > 1 && (
                  <button onClick={() => setRemiseVol((r) => ({ ...r, paliers: r.paliers.filter((_, i) => i !== idx) }))}
                    style={{ background: "none", border: "none", color: "var(--danger-fg)", cursor: "pointer" }}><Trash2 size={14} /></button>
                )}
              </div>
            ))}
            <button onClick={() => setRemiseVol((r) => ({ ...r, paliers: [...(r.paliers || []), { minKg: 0, remise: 0 }] }))}
              style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: 8, padding: "7px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", marginTop: 4 }}>
              + Ajouter un palier
            </button>
            <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 12 }}>
              Exemple : un colis de 60 kg à 12 €/kg passe de {fmt(720, "EUR")} à {fmt(720 * (1 - remiseVolumePourcent(60, remiseVol) / 100), "EUR")}.
            </div>
          </div>
        )}
      </div>

      <button onClick={save} style={{ background: "#3D63FF", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Enregistrer</button>
    </div>
  );
}

function CommissionsPage({ data, persist, session, notify, onBack }) {
  const isAdmin = session?.role === "Administrateur";
  const cfg = data.commissionConfig || { parKg: 2, parUnite: 5 };
  const categories = data.categories || [];
  const [parKg, setParKg] = useState(String(cfg.parKg));
  const [parUnite, setParUnite] = useState(String(cfg.parUnite));
  const [catEdits, setCatEdits] = useState({});

  function saveGeneral() {
    const k = Number(String(parKg).replace(",", "."));
    const u = Number(String(parUnite).replace(",", "."));
    if (isNaN(k) || isNaN(u) || k < 0 || u < 0) return;
    persist({ ...data, commissionConfig: { parKg: k, parUnite: u }, activityLog: pushActivity(data, session, "Taux de commission modifié", `${k} €/kg, ${u} €/unité`) });
    notify?.("Taux de commission mis à jour pour toutes les agences");
  }
  function saveCategoryRate(cat) {
    const raw = catEdits[cat.id];
    if (raw === undefined) return;
    const n = raw.trim() === "" ? null : Number(String(raw).replace(",", "."));
    if (n !== null && (isNaN(n) || n < 0)) return;
    persist({ ...data, categories: categories.map((c) => (c.id === cat.id ? { ...c, commissionRate: n } : c)) });
    setCatEdits((e) => { const n2 = { ...e }; delete n2[cat.id]; return n2; });
    notify?.(`Commission personnalisée mise à jour pour "${cat.nom}"`);
  }

  // Aperçu : simulateur simple
  const [simPoids, setSimPoids] = useState("5");
  const simCommission = (Number(simPoids) || 0) * (Number(parKg) || 0);

  return (
    <div>
      <ConfigPageHeader title="Commissions par Agence" desc="Combien chaque agence gagne sur chaque colis traité — modifiable uniquement par l’Administrateur." onBack={onBack} />

      {!isAdmin && (
        <div style={{ background: "var(--surface2)", borderRadius: 8, padding: "10px 12px", fontSize: 12.5, color: "var(--muted)", marginBottom: 18, maxWidth: 560 }}>
          🔒 Seul un Administrateur peut modifier ces taux. Vous consultez les valeurs actuelles.
        </div>
      )}

      <div style={{ background: "var(--surface)", borderRadius: 14, padding: 22, maxWidth: 460, border: "1px solid var(--border)", marginBottom: 20 }}>
        <div style={{ fontWeight: 700, color: "var(--text)", fontSize: 14, marginBottom: 4 }}>Taux généraux</div>
        <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 2, marginBottom: 16 }}>S’appliquent à toutes les catégories, sauf si une catégorie a son propre taux ci-dessous.</p>
        <Field label="Commission par kg (produits facturés au poids)">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input value={parKg} onChange={(e) => setParKg(e.target.value)} disabled={!isAdmin} style={{ ...inputStyle, opacity: isAdmin ? 1 : 0.6 }} />
            <span style={{ fontSize: 12.5, color: "var(--muted)" }}>€ / kg</span>
          </div>
        </Field>
        <Field label="Commission par unité (produits facturés à l’unité)">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input value={parUnite} onChange={(e) => setParUnite(e.target.value)} disabled={!isAdmin} style={{ ...inputStyle, opacity: isAdmin ? 1 : 0.6 }} />
            <span style={{ fontSize: 12.5, color: "var(--muted)" }}>€ / unité</span>
          </div>
        </Field>
        {isAdmin && <button onClick={saveGeneral} style={{ background: "#3D63FF", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>Enregistrer</button>}
      </div>

      <div style={{ background: "var(--surface)", borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden", maxWidth: 640, marginBottom: 20 }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ fontWeight: 700, color: "var(--text)", fontSize: 14 }}>Taux personnalisés par catégorie</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>Laissez vide pour utiliser le taux général.</div>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", background: "var(--surface2)" }}>
              <th style={{ padding: "10px 16px", fontSize: 10.5, color: "var(--muted)", fontWeight: 700 }}>CATÉGORIE</th>
              <th style={{ padding: "10px 16px", fontSize: 10.5, color: "var(--muted)", fontWeight: 700 }}>UNITÉ</th>
              <th style={{ padding: "10px 16px", fontSize: 10.5, color: "var(--muted)", fontWeight: 700 }}>TAUX PERSONNALISÉ</th>
              <th style={{ padding: "10px 16px", fontSize: 10.5, color: "var(--muted)", fontWeight: 700, textAlign: "right" }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{ padding: "10px 16px", fontSize: 13, color: "var(--text)" }}>{c.emoji} {c.nom}</td>
                <td style={{ padding: "10px 16px", fontSize: 12.5, color: "var(--muted)" }}>{c.type === "kg" ? "€/kg" : "€/unité"}</td>
                <td style={{ padding: "10px 16px" }}>
                  {isAdmin ? (
                    <input
                      value={catEdits[c.id] !== undefined ? catEdits[c.id] : (c.commissionRate ?? "")}
                      onChange={(e) => setCatEdits((s) => ({ ...s, [c.id]: e.target.value }))}
                      onKeyDown={(e) => e.key === "Enter" && saveCategoryRate(c)}
                      placeholder={`défaut : ${c.type === "kg" ? parKg : parUnite}`}
                      style={{ ...inputStyle, width: 120 }}
                    />
                  ) : (
                    <span style={{ fontSize: 13, color: "var(--muted)" }}>{c.commissionRate != null ? `${c.commissionRate} €` : "taux général"}</span>
                  )}
                </td>
                <td style={{ padding: "10px 16px", textAlign: "right" }}>
                  {isAdmin && catEdits[c.id] !== undefined && <button onClick={() => saveCategoryRate(c)} style={{ background: "#3ECB84", color: "#0A2647", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>Enregistrer</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ background: "var(--surface)", borderRadius: 14, padding: 20, border: "1px solid var(--border)", maxWidth: 320 }}>
        <div style={{ fontWeight: 700, color: "var(--text)", fontSize: 14, marginBottom: 12 }}>Exemple rapide</div>
        <Field label="Poids simulé (kg)"><input value={simPoids} onChange={(e) => setSimPoids(e.target.value)} style={inputStyle} /></Field>
        <div style={{ background: "var(--surface2)", borderRadius: 8, padding: "10px 12px", fontSize: 14, fontWeight: 700, color: "var(--text)", textAlign: "center" }}>
          L’agence gagne {fmt(simCommission, "EUR")}
        </div>
      </div>
    </div>
  );
}

function GestionDevisesPage({ data, persist, session, notify, onBack }) {
  const isAdmin = session?.role === "Administrateur";
  const rates = data?.exchangeRates || CURRENCIES;
  const [edits, setEdits] = useState({});
  const [testAmount, setTestAmount] = useState("100");
  const [testFrom, setTestFrom] = useState("EUR");
  const [testTo, setTestTo] = useState("GNF");
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState(null);

  const currenciesList = Object.keys(rates).filter((c) => c !== "GNF"); // GNF est la devise de référence Guinée, toujours affichée séparément

  function countriesFor(cur) {
    return COUNTRIES.filter((c) => c.currency === cur);
  }

  function save(cur) {
    const raw = edits[cur];
    if (raw === undefined) return;
    const cleaned = String(raw).replace(/\s/g, "").replace(",", ".");
    const n = Number(cleaned); // n = combien de GNF pour 1 unité de `cur`
    if (isNaN(n) || n <= 0) return;
    // Le système interne exprime tous les taux relativement à 1 EUR (EUR reste toujours la base = 1).
    // Éditer "EUR → GNF" fixe donc directement le taux GNF de référence.
    // Éditer une autre devise recalcule son propre taux pour que son équivalent en GNF corresponde à la valeur saisie.
    const gnfPerEur = cur === "EUR" ? n : (rates.GNF || CURRENCIES.GNF);
    const merged = cur === "EUR" ? { ...rates, GNF: n } : { ...rates, [cur]: gnfPerEur / n };
    persist({ ...data, exchangeRates: merged, activityLog: pushActivity(data, session, "Taux de change modifié", `1 ${cur} = ${n.toLocaleString("fr-FR")} GNF`) });
    setEdits((e) => { const n2 = { ...e }; delete n2[cur]; return n2; });
    notify?.(`Taux ${cur} → GNF mis à jour : tous les pays en ${cur} sont synchronisés automatiquement`);
  }

  function testConversion() {
    const amount = Number(String(testAmount).replace(",", ".")) || 0;
    const eurBase = amount / (LIVE_RATES[testFrom] || 1);
    const result = eurBase * (LIVE_RATES[testTo] || 1);
    return result;
  }

  function synchroniser() {
    setSyncing(true);
    // Force la relecture des taux en vigueur dans LIVE_RATES et republie les données pour rafraîchir tous les affichages (colis, catégories, frais).
    LIVE_RATES = { ...CURRENCIES, ...rates };
    persist({ ...data });
    const nbPays = COUNTRIES.filter((c) => c.code !== "GN").length;
    const nbCategories = (data.categories || []).length;
    setTimeout(() => {
      setSyncing(false);
      setSyncMsg(`Synchronisation terminée : ${nbPays} pays et ${nbCategories} catégories mis à jour selon les taux actuels.`);
      notify?.("Toutes les données ont été synchronisées");
    }, 500);
  }

  return (
    <div>
      <ConfigPageHeader title="Gestion des devises" desc="Un seul taux par devise — tous les pays qui la partagent sont mis à jour automatiquement." onBack={onBack} />

      <div style={{ background: "var(--surface)", borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden", marginBottom: 22, maxWidth: 640 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left" }}>
              <th style={{ padding: "12px 16px", fontSize: 10.5, color: "var(--muted)", fontWeight: 700, letterSpacing: 0.5 }}>DEVISE</th>
              <th style={{ padding: "12px 16px", fontSize: 10.5, color: "var(--muted)", fontWeight: 700, letterSpacing: 0.5 }}>PAYS CONCERNÉS</th>
              <th style={{ padding: "12px 16px", fontSize: 10.5, color: "var(--muted)", fontWeight: 700, letterSpacing: 0.5 }}>TAUX (1 UNITÉ → GNF)</th>
              <th style={{ padding: "12px 16px", fontSize: 10.5, color: "var(--muted)", fontWeight: 700, letterSpacing: 0.5, textAlign: "right" }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderTop: "1px solid var(--border)", background: "var(--surface2)" }}>
              <td style={{ padding: "12px 16px", fontWeight: 700, color: "var(--text)" }}>{FLAGS.GN} GNF</td>
              <td style={{ padding: "12px 16px", fontSize: 12, color: "var(--muted)" }}>Guinée (devise de référence)</td>
              <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--muted)" }}>—</td>
              <td></td>
            </tr>
            {currenciesList.map((cur) => {
              const paysListe = countriesFor(cur);
              const gnfRate = (rates.GNF || CURRENCIES.GNF) / (rates[cur] || 1); // 1 unité de `cur` en GNF
              return (
                <tr key={cur} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "12px 16px", fontWeight: 700, color: "var(--text)" }}>{cur}</td>
                  <td style={{ padding: "12px 16px", fontSize: 12, color: "var(--muted)" }}>
                    {paysListe.length > 0 ? paysListe.map((c) => `${FLAGS[c.code]} ${c.name}`).join(", ") : "Aucun pays associé pour l’instant"}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    {isAdmin ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <input
                          value={edits[cur] !== undefined ? edits[cur] : gnfRate.toLocaleString("fr-FR", { maximumFractionDigits: 4 })}
                          onChange={(e) => setEdits((s) => ({ ...s, [cur]: e.target.value }))}
                          onKeyDown={(e) => e.key === "Enter" && save(cur)}
                          style={{ ...inputStyle, width: 130 }}
                        />
                        <span style={{ fontSize: 11.5, color: "var(--muted)" }}>GNF</span>
                      </div>
                    ) : (
                      <span style={{ fontSize: 13, color: "var(--text)" }}>{gnfRate.toLocaleString("fr-FR", { maximumFractionDigits: 4 })} GNF</span>
                    )}
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "right" }}>
                    {isAdmin && edits[cur] !== undefined && (
                      <button onClick={() => save(cur)} style={{ background: "#3ECB84", color: "#0A2647", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>Enregistrer</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
        <div style={{ background: "var(--surface)", borderRadius: 14, padding: 20, border: "1px solid var(--border)", width: "min(92vw, 320px)" }}>
          <div style={{ fontWeight: 700, color: "var(--text)", fontSize: 14, marginBottom: 12 }}>Tester la conversion</div>
          <Field label="Montant"><input value={testAmount} onChange={(e) => setTestAmount(e.target.value)} style={inputStyle} /></Field>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <div style={{ flex: 1 }}><Field label="De"><select value={testFrom} onChange={(e) => setTestFrom(e.target.value)} style={inputStyle}>{Object.keys(rates).map((c) => <option key={c} value={c}>{c}</option>)}</select></Field></div>
            <div style={{ flex: 1 }}><Field label="Vers"><select value={testTo} onChange={(e) => setTestTo(e.target.value)} style={inputStyle}>{Object.keys(rates).map((c) => <option key={c} value={c}>{c}</option>)}</select></Field></div>
          </div>
          <div style={{ background: "var(--surface2)", borderRadius: 8, padding: "10px 12px", fontSize: 15, fontWeight: 700, color: "var(--text)", textAlign: "center" }}>
            {testAmount || 0} {testFrom} = {testConversion().toLocaleString("fr-FR", { maximumFractionDigits: 2 })} {testTo}
          </div>
        </div>

        {isAdmin && (
          <div style={{ background: "var(--surface)", borderRadius: 14, padding: 20, border: "1px solid var(--border)", width: "min(92vw, 320px)" }}>
            <div style={{ fontWeight: 700, color: "var(--text)", fontSize: 14, marginBottom: 8 }}>Synchronisation</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 14 }}>Recalcule immédiatement les prix de catégories, frais d’expédition et montants affichés selon les taux actuels.</div>
            <button onClick={synchroniser} disabled={syncing} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "#3D63FF", color: "#fff", border: "none", borderRadius: 8, padding: "11px 0", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              {syncing ? <RefreshCw size={15} /> : <RefreshCw size={15} />} {syncing ? "Synchronisation…" : "Synchroniser toutes les données"}
            </button>
            {syncMsg && <div style={{ marginTop: 12, background: "var(--ok-bg-soft)", color: "var(--ok-fg)", borderRadius: 8, padding: "10px 12px", fontSize: 12 }}>✓ {syncMsg}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

function emptyCategory() {
  return { id: `cat-${Date.now()}`, nom: "", description: "", emoji: "📦", type: "unite", prix: "0", devise: "GNF", visibiliteColis: true, visibiliteFactures: true, paysLimite: null, parDefaut: false, ordre: 0, motsCles: [] };
}

function CategoriesProduitsPage({ data, persist, session, notify, onBack }) {
  const isAdmin = session?.role === "Administrateur";
  const categories = data?.categories || [];
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(null);
  const [categorieASupprimer, setCategorieASupprimer] = useState(null); // category being created/edited (raw form state)
  const [motsClesText, setMotsClesText] = useState("");
  const [testInput, setTestInput] = useState("");
  const [testResult, setTestResult] = useState(null);
  const [saved, setSaved] = useState(false);

  const filtered = categories.filter((c) => !query || pourRecherche(c.nom).includes(pourRecherche(query)) || pourRecherche(c.description).includes(pourRecherche(query)) || c.motsCles?.some((k) => pourRecherche(k).includes(pourRecherche(query))));

  function openNew() {
    setForm(emptyCategory());
    setMotsClesText("");
    setSaved(false);
  }
  function openEdit(cat) {
    setForm({ ...cat, prix: String(cat.montant ?? cat.prixGNF ?? 0), devise: cat.deviseSaisie || "GNF" });
    setMotsClesText((cat.motsCles || []).join(", "));
    setSaved(false);
  }

  function confirmPrix() {
    if (isNaN(Number(form.prix)) || Number(form.prix) < 0) return;
    setSaved(true);
    notify?.(`Montant confirmé : ${form.prix} ${form.devise} — équivalent actuel ${fmtGNF(catPriceGNF({ montant: form.prix, deviseSaisie: form.devise }))}, se recalculera automatiquement si le taux change`);
  }

  function saveCategory() {
    if (!form.nom.trim()) return;
    const motsCles = motsClesText.split(",").map((k) => k.trim()).filter(Boolean);
    const exists = categories.some((c) => c.id === form.id);
    const payload = { ...form, montant: Number(form.prix) || 0, deviseSaisie: form.devise, motsCles };
    delete payload.prix; delete payload.devise; delete payload.prixGNF;
    const next = exists ? categories.map((c) => (c.id === form.id ? payload : c)) : [...categories, payload];
    persist({ ...data, categories: next });
    notify?.(exists ? "Catégorie mise à jour" : "Catégorie créée");
    setForm(null);
  }
  function removeCategory(id) {
    persist({ ...data, categories: categories.filter((c) => c.id !== id) });
  }
  function testDetection() {
    const q = testInput.toLowerCase();
    const match = categories.find((c) => c.motsCles?.some((k) => q.includes(k.toLowerCase())));
    setTestResult(match ? match.nom : "Aucune catégorie détectée");
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <ConfigPageHeader title="Gestion des Catégories de Produits" desc="Configurez les catégories et leurs tarifs pour votre entreprise." onBack={onBack} />
        {isAdmin && !form && <button onClick={openNew} style={{ display: "flex", alignItems: "center", gap: 6, background: "#3D63FF", color: "#fff", border: "none", borderRadius: 8, padding: "10px 16px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}><Plus size={16} /> Nouvelle Catégorie</button>}
      </div>

      {!form && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", marginBottom: 18, maxWidth: 420 }}>
          <Search size={15} color="var(--muted)" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher par nom, description ou mots-clés..." style={{ border: "none", outline: "none", background: "none", flex: 1, fontSize: 13.5, color: "var(--text)" }} />
        </div>
      )}

      {categorieASupprimer && (
        <ConfirmerAction
          titre="Supprimer cette catégorie ?"
          message={`« ${categorieASupprimer.nom} » ne sera plus proposée à la création d’un colis.`}
          consequence="Les colis déjà enregistrés avec cette catégorie gardent leur prix : rien n’est recalculé. Seule la saisie future est affectée."
          onConfirmer={() => { removeCategory(categorieASupprimer.id); setCategorieASupprimer(null); }}
          onAnnuler={() => setCategorieASupprimer(null)}
        />
      )}

      {form ? (
        <div style={{ background: "var(--surface)", borderRadius: 14, border: "1px solid var(--border)", maxWidth: 560 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ fontWeight: 700, color: "var(--text)", fontSize: 15 }}>{categories.some((c) => c.id === form.id) ? "Modifier la catégorie" : "Nouvelle catégorie"}</div>
            {saved && <span style={{ background: "var(--ok-bg-soft)", color: "var(--ok-fg)", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20 }}>Prix confirmé ✓</span>}
          </div>

          <div style={{ padding: "18px 20px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", letterSpacing: 0.5, marginBottom: 10 }}>INFORMATIONS DE BASE</div>
            <Field label="Nom de la catégorie *"><input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} style={inputStyle} placeholder="ex : Électronique Premium" /></Field>
            <Field label="Description"><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={inputStyle} placeholder="Description détaillée" /></Field>
            <Field label="Emoji"><input value={form.emoji} onChange={(e) => setForm({ ...form, emoji: e.target.value })} style={{ ...inputStyle, width: 70 }} /></Field>

            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", letterSpacing: 0.5, margin: "18px 0 10px" }}>TARIFICATION</div>
            <Field label="Type de tarification *">
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} style={inputStyle}>
                <option value="unite">Par unité</option>
                <option value="kg">Par kg</option>
              </select>
            </Field>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
              <div style={{ flex: 1 }}>
                <Field label="Prix *"><input value={form.prix} onChange={(e) => setForm({ ...form, prix: e.target.value })} style={inputStyle} /></Field>
              </div>
              <div style={{ width: 110 }}>
                <Field label="Devise"><select value={form.devise} onChange={(e) => setForm({ ...form, devise: e.target.value })} style={inputStyle}>{Object.keys(data?.exchangeRates || CURRENCIES).map((c) => <option key={c} value={c}>{c}</option>)}</select></Field>
              </div>
              <button onClick={confirmPrix} style={{ marginBottom: 14, background: "#3ECB84", color: "#0A2647", border: "none", borderRadius: 8, padding: "9px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>Confirmer</button>
            </div>
            <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: -8, marginBottom: 14 }}>
              ⚠️ Prix recalculé en direct selon le taux actuel{Number(form.prix) > 0 ? ` — équivalent : ${fmtGNF(catPriceGNF({ montant: form.prix, deviseSaisie: form.devise }))}` : " — cliquez sur Confirmer pour valider la saisie"}
            </div>

            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", letterSpacing: 0.5, margin: "18px 0 10px" }}>PORTÉE D’APPLICATION</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>Visibilité par contexte</div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, cursor: "pointer", fontSize: 13, color: "var(--text)" }}>
              <input type="checkbox" checked={form.visibiliteColis} onChange={(e) => setForm({ ...form, visibiliteColis: e.target.checked })} /> Création de colis
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, cursor: "pointer", fontSize: 13, color: "var(--text)" }}>
              <input type="checkbox" checked={form.visibiliteFactures} onChange={(e) => setForm({ ...form, visibiliteFactures: e.target.checked })} /> Factures commerciales
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, cursor: "pointer", fontSize: 13, color: "var(--text)" }}>
              <input type="checkbox" checked={!!form.paysLimite} onChange={(e) => setForm({ ...form, paysLimite: e.target.checked ? "FR" : null })} />
              <span>Limiter à un pays spécifique<br /><span style={{ fontSize: 11, color: "var(--muted)" }}>Par défaut universelle, activez pour un pays unique</span></span>
            </label>
            {form.paysLimite && (
              <select value={form.paysLimite} onChange={(e) => setForm({ ...form, paysLimite: e.target.value })} style={{ ...inputStyle, marginBottom: 14 }}>
                {COUNTRIES.filter((c) => c.code !== "GN").map((c) => <option key={c.code} value={c.code}>{FLAGS[c.code]} {c.name}</option>)}
              </select>
            )}

            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", letterSpacing: 0.5, margin: "18px 0 10px" }}>OPTIONS AVANCÉES</div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, cursor: "pointer", fontSize: 13, color: "var(--text)" }}>
              <input type="checkbox" checked={form.parDefaut} onChange={(e) => setForm({ ...form, parDefaut: e.target.checked })} /> Catégorie par défaut
            </label>
            <Field label="Ordre d’affichage"><input value={form.ordre} onChange={(e) => setForm({ ...form, ordre: e.target.value })} style={inputStyle} /></Field>

            <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text)", margin: "18px 0 8px", display: "flex", alignItems: "center", gap: 6 }}><Sparkles size={13} /> Mots-clés de détection automatique</div>
            <textarea value={motsClesText} onChange={(e) => setMotsClesText(e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} placeholder="iphone, samsung, galaxy, smartphone, téléphone, mobile" />
            <div style={{ fontSize: 11, color: "var(--muted)", margin: "6px 0 14px" }}>Séparez les mots-clés par des virgules pour la détection automatique.</div>

            <Field label="Test de détection"><input value={testInput} onChange={(e) => setTestInput(e.target.value)} style={inputStyle} placeholder="ex: iPhone 15 Pro Max" /></Field>
            <button onClick={testDetection} style={{ width: "100%", background: "#3D63FF", color: "#fff", border: "none", borderRadius: 8, padding: "10px 0", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Tester</button>
            {testResult && <div style={{ marginTop: 10, fontSize: 12.5, color: testResult === "Aucune catégorie détectée" ? "var(--warn-fg)" : "var(--ok-fg)" }}>{testResult === "Aucune catégorie détectée" ? testResult : `Catégorie détectée : ${testResult}`}</div>}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderTop: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 18 }}>{form.emoji}</span>
              <div><div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{form.nom || "Nom de la catégorie"}</div><div style={{ fontSize: 11.5, color: "var(--muted)" }}>{fmtGNF(catPriceGNF({ montant: form.prix, deviseSaisie: form.devise }))}/{form.type === "kg" ? "kg" : "unité"}</div></div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setForm(null)} style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 13, cursor: "pointer" }}>Annuler</button>
              <button onClick={saveCategory} style={{ background: "#3D63FF", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{categories.some((c) => c.id === form.id) ? "Enregistrer" : "Créer"}</button>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 14 }}>
          {filtered.sort((a, b) => (a.ordre || 0) - (b.ordre || 0)).map((c) => (
            <div key={c.id} style={{ background: "var(--surface)", borderRadius: 14, padding: 18, border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 22 }}>{c.emoji}</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{c.nom}{c.parDefaut && <span style={{ marginLeft: 6, fontSize: 10, color: "var(--info-fg)" }}>défaut</span>}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>{fmtGNF(catPriceGNF(c))}/{c.type === "kg" ? "kg" : "unité"} <span style={{ fontSize: 10, opacity: 0.7 }}>({c.montant} {c.deviseSaisie})</span></div>
                  </div>
                </div>
                {isAdmin && (
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => openEdit(c)} style={{ background: "none", border: "none", color: "var(--info-fg)", cursor: "pointer" }}><Settings size={14} /></button>
                    <button onClick={() => setCategorieASupprimer(c)} style={{ background: "none", border: "none", color: "var(--danger-fg)", cursor: "pointer" }}><Trash2 size={14} /></button>
                  </div>
                )}
              </div>
              {c.description && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>{c.description}</div>}
              {c.paysLimite && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>{FLAGS[c.paysLimite]} Limité à {COUNTRIES.find((x) => x.code === c.paysLimite)?.name}</div>}
              {c.motsCles?.length > 0 && <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 6 }}>🔑 {c.motsCles.slice(0, 4).join(", ")}{c.motsCles.length > 4 ? "…" : ""}</div>}
            </div>
          ))}
          {filtered.length === 0 && <div style={{ color: "var(--muted)", fontSize: 13 }}>Aucune catégorie ne correspond à votre recherche.</div>}
        </div>
      )}
    </div>
  );
}

const inputStyle = { width: "100%", border: `1.5px solid ${BORDER}`, borderRadius: 8, padding: "9px 11px", fontSize: 13.5, outline: "none", color: TEXT, background: SURFACE2 };
const toggleBtn = { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, border: `1.5px solid ${BORDER}`, background: SURFACE2, borderRadius: 8, padding: "9px 0", fontSize: 13, cursor: "pointer", color: MUTED };
const toggleActive = { background: BLUE, color: "#fff", borderColor: BLUE };

const Field = memo(function Field({ label, children }) {
  return <div style={{ marginBottom: 14 }}><div style={{ fontSize: 12, fontWeight: 600, color: MUTED, marginBottom: 6 }}>{label}</div>{children}</div>;
});

/**
 * Vue d’ensemble administrative de toutes les pré-alertes clients, tous comptes confondus —
 * pour un suivi total, indépendamment de la création d’un colis en particulier. Le badge dans
 * le menu latéral indique en temps réel le nombre de pré-alertes encore en attente.
 */
/** Vue staff des messages et des demandes de regroupement, deux flux distincts venant des
 * clients de l’Espace Client, regroupés ici pour un point d’entrée unique. */
/**
 * Centre clients — regroupe en un seul endroit tout ce qui vient de l’Espace Client et
 * demande une action de l’agence : messages, pré-alertes à rapprocher, demandes de
 * regroupement, et signalements de problème. Ces quatre flux étaient auparavant éparpillés
 * (les pré-alertes avaient leur propre page, et les signalements n’étaient visibles qu’en
 * ouvrant chaque colis un par un, sans vue d’ensemble) — ils sont maintenant réunis avec un
 * seul badge de notification combiné dans le menu.
 */
/**
 * Traitement d'une pré-alerte par l'agence.
 *
 * Le client annonce une commande (référence, boutique, nombre d'articles, valeur) sans
 * indiquer de poids : il ne peut pas le connaître. À l'arrivée du colis, l'agent corrige si
 * besoin les informations, pèse le colis, et le prix se calcule automatiquement selon les
 * paliers de réception (Configuration → Tarifs de réception). La validation crée un vrai colis
 * rattaché au compte du client, qui le voit alors apparaître dans son espace.
 */
/**
 * Vérification d'une référence — utilisable par un agent comme par un client.
 *
 * On cherche sur tous les identifiants possibles : numéro de suivi Ba-Diaby, référence de la
 * commande chez le vendeur, nom ou téléphone du destinataire. Trois réponses possibles :
 * le colis existe (avec la date de chaque étape franchie), la commande est annoncée mais pas
 * encore reçue, ou la référence est introuvable.
 *
 * Côté client, la recherche est volontairement limitée à SES propres colis : sans cela,
 * n'importe qui pourrait consulter les envois des autres en devinant une référence.
 */
function VerifierReferenceModal({ data, compteClient, onClose }) {
  const [requete, setRequete] = useState("");
  const [recherche, setRecherche] = useState(false);

  const q = pourRecherche(requete.trim());
  const colisSource = compteClient ? data.colis.filter((c) => c.clientAccountId === compteClient.id) : data.colis;
  const preAlertesSource = compteClient
    ? (data.preAlertes || []).filter((p) => p.clientAccountId === compteClient.id)
    : (data.preAlertes || []);

  const correspond = (c) => [c.tracking, c.referenceCommande, c.destinataire, c.telephone, c.notesInternes]
    .filter(Boolean).some((v) => pourRecherche(v).includes(q));

  const colisTrouves = q ? colisSource.filter(correspond) : [];
  const preAlertesTrouvees = q ? preAlertesSource.filter((p) =>
    [p.trackingExterne, p.description, p.provenance].filter(Boolean).some((v) => pourRecherche(v).includes(q))
    && !colisTrouves.some((c) => c.tracking === p.colisTracking)) : [];

  const dateEtape = (colis, statut) => {
    const e = (colis.historique || []).find((h) => h.status === statut);
    return e ? new Date(e.date).toLocaleDateString("fr-FR") : null;
  };

  return (
    <Modal onClose={onClose} title="Vérifier une référence" wide>
      <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 12 }}>
        Numéro de suivi, référence de la commande{compteClient ? "" : ", nom ou téléphone du destinataire"} — saisissez ce que vous avez.
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        <input value={requete} autoFocus onChange={(e) => { setRequete(e.target.value); setRecherche(true); }}
          placeholder="Ex : BDE123456 ou SHEIN-98213" style={{ ...inputStyle, flex: 1, marginBottom: 0 }} />
      </div>

      {!q && <div style={{ fontSize: 12.5, color: "var(--muted)", textAlign: "center", padding: "20px 0" }}>Saisissez une référence pour lancer la recherche.</div>}

      {q && colisTrouves.length === 0 && preAlertesTrouvees.length === 0 && recherche && (
        <div style={{ background: "var(--danger-bg)", border: "1px solid var(--danger-border)", borderRadius: 12, padding: 18, textAlign: "center" }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--danger-fg)" }}>Référence introuvable</div>
          <div style={{ fontSize: 12.5, color: "var(--danger-fg-soft)", marginTop: 5 }}>
            « {requete.trim()} » ne correspond à aucun colis ni à aucune commande annoncée{compteClient ? " sur votre compte" : " dans la base"}.
          </div>
        </div>
      )}

      {colisTrouves.map((c) => (
        <div key={c.tracking} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 16, marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{c.tracking}</div>
              <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
                {c.destinataire}{c.referenceCommande ? ` · réf. ${c.referenceCommande}` : ""} · {c.poids} kg
              </div>
            </div>
            <span style={{ background: STATUS_STYLE[c.status]?.bg, color: STATUS_STYLE[c.status]?.fg, padding: "4px 11px", borderRadius: 20, fontSize: 11.5, fontWeight: 700 }}>
              {clientStatusLabel(c.status)}
            </span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
            {CLIENT_TIMELINE.filter((e) => e.statuses.length).map((etape) => {
              const d = etape.statuses.map((st) => dateEtape(c, st)).find(Boolean);
              return (
                <div key={etape.key} style={{ fontSize: 11.5 }}>
                  <div style={{ color: "var(--muted)" }}>{etape.label}</div>
                  <div style={{ color: d ? "var(--ok-fg)" : "var(--muted)", fontWeight: d ? 700 : 400 }}>{d || "—"}</div>
                </div>
              );
            })}
          </div>
          {c.reste > 0 && (
            <div style={{ marginTop: 10, fontSize: 12, color: "var(--danger-fg)", fontWeight: 600 }}>
              Reste à payer : {fmtGNF(c.reste * (LIVE_RATES.GNF || CURRENCIES.GNF))}
            </div>
          )}
        </div>
      ))}

      {preAlertesTrouvees.map((p) => (
        <div key={p.id} style={{ background: "var(--warn-bg)", border: "1px solid var(--warn-border)", borderRadius: 12, padding: 16, marginBottom: 10 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--warn-fg)" }}>Commande annoncée — pas encore reçue</div>
          <div style={{ fontSize: 12.5, color: "var(--text)", marginTop: 5 }}>
            {p.provenance} · réf. {p.trackingExterne}{p.description ? ` — ${p.description}` : ""}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 3 }}>
            Annoncée le {new Date(p.dateCreation).toLocaleDateString("fr-FR")} · en attente d'arrivée à l'entrepôt
          </div>
        </div>
      ))}
    </Modal>
  );
}

function TraiterPreAlerteModal({ preAlerte, client, tarifs, onValider, onClose }) {
  const [reference, setReference] = useState(preAlerte.trackingExterne || "");
  const [provenance, setProvenance] = useState(preAlerte.provenance || "Autre");
  const [description, setDescription] = useState(preAlerte.description || "");
  const [nbArticles, setNbArticles] = useState(preAlerte.nbArticles ? String(preAlerte.nbArticles) : "1");
  const [valeurCommande, setValeurCommande] = useState(preAlerte.valeurCommande ? String(preAlerte.valeurCommande) : "");
  const [poids, setPoids] = useState("");
  // Pays de l'entrepôt où le colis est réceptionné : c'est lui qui détermine la route du
  // bordereau (ex. Paris → Conakry). Sans cette information le colis ne pourrait entrer dans
  // aucun bordereau d'expédition.
  const [paysOrigine, setPaysOrigine] = useState("FR");
  const [erreur, setErreur] = useState("");

  const poidsNum = Number(poids) || 0;
  const calcul = poidsNum > 0 ? calcReceptionFee(poidsNum, tarifs) : null;

  function valider() {
    if (!(poidsNum > 0)) { setErreur("Indiquez le poids réel du colis pour calculer le prix."); return; }
    onValider({
      reference: reference.trim(), provenance, description: description.trim(),
      nbArticles: Number(nbArticles) || 1,
      valeurCommande: valeurCommande ? Number(valeurCommande) : null,
      poids: poidsNum, prixGNF: calcul.total, tauxParKg: calcul.tauxParKg,
      paysOrigine,
    });
  }

  return (
    <Modal onClose={onClose} title="Réception du colis annoncé" wide saisieEnCours={!!poids}>
      <div style={{ background: "var(--surface2)", borderRadius: 12, padding: "10px 14px", marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{client ? `${client.prenom} ${client.nom}` : "Compte inconnu"}</div>
        <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{client?.telephone} · annoncé le {new Date(preAlerte.dateCreation).toLocaleDateString("fr-FR")}</div>
      </div>

      <div style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 700, marginBottom: 8 }}>INFORMATIONS ANNONCÉES PAR LE CLIENT (modifiables)</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        <select value={provenance} onChange={(e) => setProvenance(e.target.value)} style={{ ...inputStyle, width: 140, marginBottom: 0 }}>
          {VENDEURS_EN_LIGNE.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
        <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Référence de la commande" style={{ ...inputStyle, flex: 1, minWidth: 150, marginBottom: 0 }} />
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>Réceptionné à l’entrepôt de</span>
        <select value={paysOrigine} onChange={(e) => setPaysOrigine(e.target.value)} style={{ ...inputStyle, width: 210, marginBottom: 0 }}>
          {COUNTRIES.filter((c) => c.code !== "GN").map((c) => <option key={c.code} value={c.code}>{FLAGS[c.code] || ""} {c.name} — {c.city}</option>)}
        </select>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description du contenu" style={{ ...inputStyle, flex: 1, minWidth: 160, marginBottom: 0 }} />
        <input type="number" min="1" value={nbArticles} onChange={(e) => setNbArticles(e.target.value)} placeholder="Nombre d'articles" style={{ ...inputStyle, width: 130, marginBottom: 0 }} />
        <input type="number" step="0.01" min="0" value={valeurCommande} onChange={(e) => setValeurCommande(e.target.value)} placeholder="Valeur commande (€)" style={{ ...inputStyle, width: 150, marginBottom: 0 }} />
      </div>

      <div style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 700, margin: "18px 0 8px" }}>PESÉE ET TARIFICATION</div>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
        <input type="number" step="0.1" min="0" value={poids} onChange={(e) => { setPoids(e.target.value); setErreur(""); }} placeholder="Poids réel (kg)" autoFocus style={{ ...inputStyle, width: 150, marginBottom: 0 }} />
        <div style={{ flex: 1, minWidth: 220, background: calcul ? "var(--ok-bg)" : "var(--surface2)", border: "1px solid " + (calcul ? "var(--ok-border)" : "var(--border)"), borderRadius: 12, padding: "10px 14px" }}>
          {calcul ? (
            <>
              <div style={{ fontSize: 11.5, color: "var(--muted)" }}>Palier {calcul.palier.max <= 10 ? "1 à 10 kg" : calcul.palier.max <= 40 ? "11 à 40 kg" : "41 à 100 kg"} · {fmtGNF(calcul.tauxParKg)}/kg</div>
              <div style={{ fontSize: 19, fontWeight: 700, color: "var(--ok-fg)", fontFamily: "'Space Grotesk',sans-serif" }}>{fmtGNF(calcul.total)}</div>
            </>
          ) : (
            <div style={{ fontSize: 12.5, color: "var(--muted)" }}>Saisissez le poids : le prix se calcule automatiquement selon vos paliers de réception.</div>
          )}
        </div>
      </div>
      {erreur && <div style={{ fontSize: 12, color: "var(--danger-fg)", marginTop: 10 }}>{erreur}</div>}

      <button onClick={valider} style={{ width: "100%", marginTop: 18, background: "var(--brand-solid)", color: "#fff", border: "none", borderRadius: 8, padding: "12px 0", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
        Valider — Reçu à l'entrepôt
      </button>
      <div style={{ fontSize: 11, color: "var(--muted)", textAlign: "center", marginTop: 8 }}>
        Un colis sera créé au nom du client et apparaîtra aussitôt dans son espace.
      </div>
    </Modal>
  );
}

function CentreClientsPage({ data, persist, notify, session }) {
  const [ongletActif, setOngletActif] = useState("messages");
  const [clientOuvert, setClientOuvert] = useState(null);
  const [reponse, setReponse] = useState("");
  const [reponsesSignalement, setReponsesSignalement] = useState({});
  const [filtrePreAlertes, setFiltrePreAlertes] = useState("en_attente");
  const [rechercheCompte, setRechercheCompte] = useState("");
  const [compteASupprimer, setCompteASupprimer] = useState(null);

  /**
   * Supprime un compte de l'Espace Client.
   *
   * Les colis ne sont PAS supprimés : ils restent dans l'historique de l'agence, simplement
   * détachés du compte. Effacer un compte ne doit jamais faire disparaître une vente ni une
   * trace comptable — seul l'accès en ligne du client est retiré.
   */
  function supprimerCompteClient(compte) {
    const next = {
      ...data,
      clientAccounts: (data.clientAccounts || []).filter((c) => c.id !== compte.id),
      colis: (data.colis || []).map((c) => (c.clientAccountId === compte.id ? { ...c, clientAccountId: null } : c)),
      preAlertes: (data.preAlertes || []).filter((p) => p.clientAccountId !== compte.id),
    };
    next.activityLog = pushActivity(data, session, "Compte client supprimé",
      `${compte.prenom} ${compte.nom} (${compte.identifiant})`);
    persist(next);
    setCompteASupprimer(null);
    notify?.("Compte supprimé — les colis sont conservés");
  }
  const clients = data.clientAccounts || [];
  const clientsAvecMessages = clients.filter((c) => (c.messages || []).length > 0).sort((a, b) => {
    const derA = a.messages[a.messages.length - 1]?.date || "";
    const derB = b.messages[b.messages.length - 1]?.date || "";
    return new Date(derB) - new Date(derA);
  });
  const demandes = (data.demandesRegroupement || []).sort((a, b) => new Date(b.dateCreation) - new Date(a.dateCreation));
  const clientsById = Object.fromEntries(clients.map((c) => [c.id, c]));
  const preAlertes = data.preAlertes || [];
  const signalementsOuverts = data.colis.flatMap((c) => (c.signalements || []).filter((s) => s.statut === "Ouvert").map((s) => ({ ...s, colis: c })))
    .sort((a, b) => new Date(b.dateCreation) - new Date(a.dateCreation));
  // Demandes de livraison express en attente de décision — auparavant visibles uniquement en
  // ouvrant chaque colis une par une, donc facilement oubliées.
  const demandesExpress = data.colis.filter((c) => c.demandeExpress && c.demandeExpress.statut === "En attente")
    .sort((a, b) => new Date(b.demandeExpress.date || 0) - new Date(a.demandeExpress.date || 0));

  /**
   * Décision de l'agence sur une demande de livraison express.
   *
   * Une acceptation FACTURE réellement le supplément : le montant est ajouté au prix du colis et
   * au reste à payer. Auparavant seul le statut changeait — le client voyait « Confirmée » mais sa
   * facture restait identique, et l'agence perdait la recette. Un refus, ou une annulation après
   * acceptation, retire le supplément pour que la facture reste juste.
   */
  function deciderExpress(colis, accepte) {
    const maintenant = new Date().toISOString();
    const dejaFacture = !!colis.demandeExpress?.facture;
    const montant = Number(colis.demandeExpress?.montant) || 0;
    // On n'ajoute le supplément qu'une seule fois, même si l'agent clique deux fois.
    const ajout = accepte && !dejaFacture ? montant : 0;
    const retrait = !accepte && dejaFacture ? montant : 0;

    persist({
      ...data,
      colis: data.colis.map((c) => {
        if (c.tracking !== colis.tracking) return c;
        const prix = Math.max(+((c.prix || 0) + ajout - retrait).toFixed(2), 0);
        return {
          ...c,
          prix,
          reste: Math.max(+(prix - (c.paye || 0)).toFixed(2), 0),
          demandeExpress: {
            ...c.demandeExpress,
            statut: accepte ? "Confirmée" : "Refusée",
            dateDecision: maintenant,
            traitePar: `${session.prenom} ${session.nom}`.trim() || session.identifiant,
            facture: accepte,
          },
        };
      }),
      activityLog: pushActivity(data, session,
        accepte ? "Livraison express acceptée" : "Livraison express refusée",
        `${colis.tracking}${ajout > 0 ? ` — supplément ${fmtGNF(ajout * (LIVE_RATES.GNF || CURRENCIES.GNF))} facturé` : ""}`),
    });
    notify?.(accepte
      ? `Express accepté — ${fmtGNF(montant * (LIVE_RATES.GNF || CURRENCIES.GNF))} ajoutés à la facture`
      : `Express refusé pour ${colis.tracking}`);
  }

  const messagesNonLus = clients.filter((c) => (c.messages || []).some((m) => m.expediteur === "client" && !m.lu)).length;
  const regroupementsEnAttente = demandes.filter((d) => d.statut === "En attente").length;
  const preAlertesEnAttente = preAlertes.filter((p) => p.statut === "En attente").length;
  const expressEnAttente = demandesExpress.length;

  function envoyerReponse(client) {
    if (!reponse.trim()) return;
    const msg = { id: `msg${Date.now()}`, expediteur: "staff", texte: reponse.trim(), date: new Date().toISOString(), lu: false, par: `${session.prenom} ${session.nom}`.trim() };
    const updated = { ...client, messages: [...(client.messages || []).map((m) => (m.expediteur === "client" ? { ...m, lu: true } : m)), msg] };
    persist({ ...data, clientAccounts: clients.map((c) => (c.id === client.id ? updated : c)) });
    setReponse("");
    notify?.("Réponse envoyée");
  }
  function ouvrirClient(client) {
    setClientOuvert(client.id);
    if ((client.messages || []).some((m) => m.expediteur === "client" && !m.lu)) {
      const updated = { ...client, messages: client.messages.map((m) => (m.expediteur === "client" ? { ...m, lu: true } : m)) };
      persist({ ...data, clientAccounts: clients.map((c) => (c.id === client.id ? updated : c)) });
    }
  }
  function majDemande(id, statut) {
    const demande = demandes.find((d) => d.id === id);
    if (statut === "Acceptée" && demande) {
      // Relie la demande de regroupement au système de bordereaux déjà existant, plutôt que
      // de simplement marquer "Acceptée" sans suite concrète : les colis regroupés sont
      // directement placés dans un nouveau bordereau (brouillon), prêt à être complété.
      const colisGroupe = data.colis.filter((c) => demande.trackings.includes(c.tracking));
      const premier = colisGroupe[0];
      if (premier) {
        const numero = genBordereauNumero(data.bordereaux || []);
        const bordereau = { id: `bord-${Date.now()}`, numero, pays: premier.pays, direction: premier.direction || "export", colisTrackings: demande.trackings, statut: "Brouillon", dateCreation: new Date().toISOString(), dateModif: new Date().toISOString(), historique: [{ statut: "Brouillon", date: new Date().toISOString(), par: `${session.prenom} ${session.nom}` }] };
        persist({
          ...data,
          bordereaux: [bordereau, ...(data.bordereaux || [])],
          demandesRegroupement: demandes.map((d) => (d.id === id ? { ...d, statut, bordereauNumero: numero, dateMaj: new Date().toISOString() } : d)),
          activityLog: pushActivity(data, session, "Bordereau créé depuis un regroupement client", `${numero} — ${demande.trackings.length} colis`),
        });
        notify?.(`Regroupement accepté — bordereau ${numero} créé en brouillon`);
        return;
      }
    }
    persist({ ...data, demandesRegroupement: demandes.map((d) => (d.id === id ? { ...d, statut, dateMaj: new Date().toISOString() } : d)) });
    notify?.(statut === "Acceptée" ? "Demande de regroupement acceptée" : "Demande refusée");
  }
  const [preAlerteEnCours, setPreAlerteEnCours] = useState(null);
  const [showVerifAgent, setShowVerifAgent] = useState(false);

  /**
   * Transforme une pré-alerte en colis réel rattaché au compte du client.
   * Le prix vient des paliers de réception, calculé à partir du poids pesé par l'agent.
   */
  function validerPreAlerte(preAlerte, saisie) {
    const client = clientsById[preAlerte.clientAccountId];
    if (!client) { notify?.("Compte client introuvable"); return; }
    const maintenant = new Date().toISOString();
    const tracking = genTracking((data.colis || []).map((c) => c.tracking));
    const prixEUR = saisie.prixGNF / (LIVE_RATES.GNF || CURRENCIES.GNF);
    const colis = {
      tracking,
      expediteur: saisie.provenance || "Achat en ligne", expediteurTelephone: "", expediteurEmail: "", expediteurAdresse: "", expediteurPays: "GN",
      destinataire: `${client.prenom} ${client.nom}`, telephone: client.telephone,
      destinataireEmail: client.email || "", destinataireAdresse: client.adresse || "",
      destinatairePays: "GN", destinataireVille: "", destinataireCodePostal: "",
      pays: saisie.paysOrigine || "FR", direction: "import", mode: "air",
      produits: [{ id: `p${Date.now()}`, nom: saisie.description || saisie.reference || "Commande en ligne",
                   quantite: String(saisie.nbArticles || 1), poids: String(saisie.poids), categorie: "" }],
      poids: saisie.poids, volume: 0, valeurDeclaree: saisie.valeurCommande || 0, site: session?.agence || "Bambeto",
      prixBrut: prixEUR, discountLoyalty: 0, rabaisMontant: 0, rabaisDevise: "GNF", rabaisEUR: 0,
      prix: prixEUR, paye: 0, reste: prixEUR, photos: [], paiements: [],
      notesInternes: `Pré-alerte ${saisie.provenance}${saisie.reference ? ` — réf. ${saisie.reference}` : ""} · ${saisie.poids} kg à ${fmtGNF(saisie.tauxParKg)}/kg`,
      // Base de tarification mémorisée : ce colis est facturé aux paliers de réception, pas au
      // barème export. Sans cette information, une simple modification recalculait le prix avec
      // la mauvaise formule et l'écrasait silencieusement.
      tarification: "reception",
      clientAccountId: client.id, provenance: saisie.provenance,
      referenceCommande: saisie.reference || null,
      status: "Enregistré", historique: [{ status: "Enregistré", date: maintenant }],
      agentCreation: session ? `${session.prenom} ${session.nom}`.trim() || session.identifiant : "",
      createdAt: maintenant, pod: null, signature: null, driverLoc: null,
    };
    persist({
      ...data,
      colis: [colis, ...data.colis],
      preAlertes: preAlertes.map((x) => (x.id === preAlerte.id
        ? { ...x, statut: "Rapproché", trackingExterne: saisie.reference, provenance: saisie.provenance,
            description: saisie.description, nbArticles: saisie.nbArticles, valeurCommande: saisie.valeurCommande,
            colisTracking: tracking, dateRapprochement: maintenant }
        : x)),
      activityLog: pushActivity(data, session, "Pré-alerte reçue à l'entrepôt", `${tracking} — ${client.prenom} ${client.nom} · ${saisie.poids} kg`),
    });
    notify?.(`Colis ${tracking} créé — ${fmtGNF(saisie.prixGNF)}`);
    setPreAlerteEnCours(null);
  }

  function marquerRapproche(id) {
    persist({ ...data, preAlertes: preAlertes.map((p) => (p.id === id ? { ...p, statut: "Rapproché" } : p)) });
    notify?.("Pré-alerte marquée comme rapprochée");
  }
  function supprimerPreAlerte(id) {
    persist({ ...data, preAlertes: preAlertes.filter((p) => p.id !== id) });
  }
  function repondreSignalement(colis, signalementId) {
    const rep = (reponsesSignalement[signalementId] || "").trim();
    persist({ ...data, colis: data.colis.map((c) => (c.tracking === colis.tracking ? { ...c, signalements: (c.signalements || []).map((s) => (s.id === signalementId ? { ...s, statut: "Résolu", reponse: rep || "Résolu par l’agence.", dateReponse: new Date().toISOString() } : s)) } : c)) });
    notify?.("Réponse envoyée au client");
  }

  const clientActif = clientOuvert ? clientsById[clientOuvert] : null;
  const preAlertesAffichees = preAlertes.filter((p) => {
    if (filtrePreAlertes === "en_attente") return p.statut === "En attente";
    if (filtrePreAlertes === "rapproche") return p.statut === "Rapproché";
    return true;
  }).sort((a, b) => new Date(b.dateCreation) - new Date(a.dateCreation));

  const onglets = [
    ["messages", "Messages", messagesNonLus],
    ["prealertes", "Pré-alertes", preAlertesEnAttente],
    ["regroupements", "Regroupements", regroupementsEnAttente],
    ["signalements", "Signalements", signalementsOuverts.length],
    ["express", "Livraison express", expressEnAttente],
    ["comptes", "Comptes inscrits", (data.clientAccounts || []).length],
  ];

  return (
    <div>
      <h1 style={{ fontFamily: "'Space Grotesk',sans-serif", color: "var(--text)", fontSize: 24, margin: "0 0 4px" }}>Centre clients</h1>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", margin: "4px 0 18px" }}>
      <p style={{ color: "var(--muted)", fontSize: 13.5, margin: 0 }}>Tout ce qui vient de l’Espace Client et attend une réponse : messages, pré-alertes, regroupements, signalements.</p>
        <button onClick={() => setShowVerifAgent(true)} style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: 8, padding: "8px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>
          <Search size={14} /> Vérifier une référence
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {onglets.map(([k, label, count]) => (
          <button key={k} onClick={() => setOngletActif(k)} style={{ padding: "7px 14px", borderRadius: 20, border: "1.5px solid " + (ongletActif === k ? "var(--brand-solid)" : "var(--border)"), background: ongletActif === k ? "var(--brand-solid)" : "var(--surface)", color: ongletActif === k ? "#fff" : "var(--muted)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
            {label}{count > 0 ? ` (${count})` : ""}
          </button>
        ))}
      </div>

      {ongletActif === "comptes" && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "0 12px", marginBottom: 16 }}>
            <Search size={15} color="var(--muted)" />
            <input value={rechercheCompte} onChange={(e) => setRechercheCompte(e.target.value)}
              placeholder="Rechercher un compte par nom, identifiant ou téléphone…"
              style={{ ...inputStyle, border: "none", background: "transparent", marginBottom: 0, flex: 1 }} />
          </div>

          {(() => {
            const q = pourRecherche(rechercheCompte.trim());
            const comptes = (data.clientAccounts || [])
              .filter((c) => !q || pourRecherche(`${c.prenom} ${c.nom} ${c.identifiant} ${c.telephone || ""}`).includes(q))
              .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

            if (comptes.length === 0) {
              return (
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 30, textAlign: "center", color: "var(--muted)", fontSize: 13.5 }}>
                  {(data.clientAccounts || []).length === 0
                    ? "Aucun client n’a encore créé de compte sur l’Espace Client."
                    : "Aucun compte ne correspond à cette recherche."}
                </div>
              );
            }

            return (
              <>
                <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>
                  {comptes.length} compte{comptes.length > 1 ? "s" : ""} inscrit{comptes.length > 1 ? "s" : ""}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {comptes.map((c) => {
                    const sesColis = (data.colis || []).filter((x) => x.clientAccountId === c.id);
                    return (
                      <div key={c.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text)" }}>{c.prenom} {c.nom}</div>
                          <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>
                            {c.identifiant}{c.telephone ? ` · ${c.telephone}` : ""}{c.email ? ` · ${c.email}` : ""}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3 }}>
                            {sesColis.length} colis
                            {c.createdAt ? ` · inscrit le ${new Date(c.createdAt).toLocaleDateString("fr-FR")}` : ""}
                            {c.derniereVisite ? ` · vu le ${new Date(c.derniereVisite).toLocaleDateString("fr-FR")}` : " · jamais revenu"}
                          </div>
                        </div>
                        <button onClick={() => setCompteASupprimer(c)} title="Supprimer ce compte"
                          style={{ background: "none", border: "1px solid var(--danger-border)", color: "var(--danger-fg)", borderRadius: 8, padding: "7px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>
                          <Trash2 size={13} /> Supprimer
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            );
          })()}
        </div>
      )}

      {compteASupprimer && (
        <Modal onClose={() => setCompteASupprimer(null)} title="Supprimer ce compte ?">
          <div style={{ fontSize: 13.5, color: "var(--text)", marginBottom: 12 }}>
            <strong>{compteASupprimer.prenom} {compteASupprimer.nom}</strong> ({compteASupprimer.identifiant})
            perdra l’accès à son Espace Client.
          </div>
          <div style={{ background: "var(--info-bg)", border: "1px solid var(--info-border)", borderRadius: 8, padding: "11px 13px", marginBottom: 16 }}>
            <div style={{ fontSize: 12.5, color: "var(--text)", lineHeight: 1.55 }}>
              Ses <strong>{(data.colis || []).filter((x) => x.clientAccountId === compteASupprimer.id).length} colis sont conservés</strong> dans
              l’historique de l’agence — ils sont simplement détachés du compte. Aucune vente ni trace
              comptable n’est effacée.
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => supprimerCompteClient(compteASupprimer)}
              style={{ flex: 1, background: "var(--brand-solid)", color: "#fff", border: "none", borderRadius: 8, padding: "11px 0", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>
              Supprimer le compte
            </button>
            <button onClick={() => setCompteASupprimer(null)}
              style={{ background: "none", border: "1px solid var(--border)", color: "var(--muted)", borderRadius: 8, padding: "11px 18px", fontSize: 13, cursor: "pointer" }}>
              Annuler
            </button>
          </div>
        </Modal>
      )}

      {ongletActif === "messages" && (
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 260px", minWidth: 240, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
            {clientsAvecMessages.length === 0 ? (
              <div style={{ padding: 20, fontSize: 12.5, color: "var(--muted)", textAlign: "center" }}>Aucun message pour le moment.</div>
            ) : clientsAvecMessages.map((c) => {
              const dernier = c.messages[c.messages.length - 1];
              const nonLu = (c.messages || []).some((m) => m.expediteur === "client" && !m.lu);
              return (
                <button key={c.id} onClick={() => ouvrirClient(c)} style={{ display: "block", width: "100%", textAlign: "start", background: clientOuvert === c.id ? "var(--surface2)" : "none", border: "none", borderBottom: "1px solid var(--border)", padding: "12px 14px", cursor: "pointer" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 13, fontWeight: nonLu ? 700 : 600, color: "var(--text)" }}>{c.prenom} {c.nom}</span>
                    {nonLu && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--brand-solid)" }} />}
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{dernier?.expediteur === "staff" ? "Vous : " : ""}{dernier?.texte}</div>
                </button>
              );
            })}
          </div>
          <div style={{ flex: "2 1 340px", minWidth: 280, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 16, display: "flex", flexDirection: "column" }}>
            {!clientActif ? (
              <div style={{ margin: "auto", fontSize: 12.5, color: "var(--muted)" }}>Sélectionnez un client pour voir la conversation.</div>
            ) : (
              <>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)", marginBottom: 10 }}>{clientActif.prenom} {clientActif.nom} <span style={{ fontWeight: 600, color: "var(--muted)" }}>· {clientActif.telephone}</span></div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, maxHeight: 320, overflowY: "auto", marginBottom: 12 }}>
                  {(clientActif.messages || []).map((m) => (
                    <div key={m.id} style={{ alignSelf: m.expediteur === "staff" ? "flex-end" : "flex-start", maxWidth: "80%", background: m.expediteur === "staff" ? "var(--brand-solid)" : "var(--surface2)", color: m.expediteur === "staff" ? "#fff" : "var(--text)", borderRadius: 12, padding: "8px 12px" }}>
                      <div style={{ fontSize: 12.5 }}>{m.texte}</div>
                      <div style={{ fontSize: 9.5, opacity: 0.75, marginTop: 3 }}>{new Date(m.date).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={reponse} onChange={(e) => setReponse(e.target.value)} placeholder="Répondre..." style={{ ...inputStyle, flex: 1, marginBottom: 0 }} onKeyDown={(e) => { if (e.key === "Enter") envoyerReponse(clientActif); }} />
                  <button onClick={() => envoyerReponse(clientActif)} style={{ background: "var(--brand-solid)", color: "#fff", border: "none", borderRadius: 8, padding: "0 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Envoyer</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {ongletActif === "prealertes" && (
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {[["en_attente", "En attente"], ["rapproche", "Rapprochées"], ["tous", "Toutes"]].map(([k, label]) => (
              <button key={k} onClick={() => setFiltrePreAlertes(k)} style={{ padding: "6px 12px", borderRadius: 20, border: "1.5px solid " + (filtrePreAlertes === k ? "var(--brand-solid)" : "var(--border)"), background: filtrePreAlertes === k ? "var(--brand-solid)" : "var(--surface)", color: filtrePreAlertes === k ? "#fff" : "var(--muted)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{label}</button>
            ))}
          </div>
          {preAlertesAffichees.length === 0 ? (
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 30, textAlign: "center", color: "var(--muted)", fontSize: 13.5 }}>Aucune pré-alerte dans cette catégorie.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {preAlertesAffichees.map((p) => {
                const client = clientsById[p.clientAccountId];
                return (
                  <div key={p.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)" }}>
                        <span style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 6, padding: "1px 7px", fontSize: 10.5, marginInlineEnd: 8 }}>{p.provenance || "Autre"}</span>
                        {p.trackingExterne}{p.description ? ` — ${p.description}` : ""}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>
                        Client : <strong style={{ color: "var(--text)" }}>{client ? `${client.prenom} ${client.nom}` : "Compte inconnu"}</strong> · {client?.telephone} · {new Date(p.dateCreation).toLocaleDateString("fr-FR")}
                        {p.nbArticles ? ` · ${p.nbArticles} article${p.nbArticles > 1 ? "s" : ""}` : ""}{p.valeurCommande ? ` · ${fmt(p.valeurCommande, "EUR")}` : ""}
                        {p.colisTracking ? <span style={{ color: "var(--ok-fg)", fontWeight: 600 }}>{` · colis ${p.colisTracking} créé`}</span> : null}{p.poidsEstime ? ` · ~${p.poidsEstime} kg` : ""}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ background: p.statut === "En attente" ? "var(--warn-bg)" : "var(--ok-bg)", color: p.statut === "En attente" ? "var(--warn-fg)" : "var(--ok-fg)", padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{p.statut}</span>
                      {p.statut === "En attente" && <button onClick={() => setPreAlerteEnCours(p)} style={{ background: "var(--brand-solid)", color: "#fff", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>Réceptionner & peser</button>}
                      {p.statut === "En attente" && <button onClick={() => marquerRapproche(p.id)} title="Marquer traitée sans créer de colis" style={{ background: "none", border: "1px solid var(--border)", color: "var(--muted)", borderRadius: 6, padding: "6px 10px", fontSize: 11.5, cursor: "pointer" }}>Classer</button>}
                      <button onClick={() => supprimerPreAlerte(p.id)} style={{ background: "none", border: "none", color: "var(--danger-fg)", cursor: "pointer" }}><X size={15} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {ongletActif === "regroupements" && (
        demandes.length === 0 ? (
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 30, textAlign: "center", color: "var(--muted)", fontSize: 13.5 }}>Aucune demande de regroupement.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {demandes.map((d) => {
              const client = clientsById[d.clientAccountId];
              return (
                <div key={d.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10, marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{client ? `${client.prenom} ${client.nom}` : "Client"}</div>
                      <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{d.trackings.join(", ")} · {new Date(d.dateCreation).toLocaleDateString("fr-FR")}</div>
                      {d.note && <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>Note : {d.note}</div>}
                      {d.bordereauNumero && <div style={{ fontSize: 11.5, color: "var(--ok-fg)", marginTop: 2 }}>→ Bordereau {d.bordereauNumero} créé (brouillon)</div>}
                    </div>
                    <span style={{ background: d.statut === "En attente" ? "var(--warn-bg)" : d.statut === "Acceptée" ? "var(--ok-bg)" : "var(--danger-bg)", color: d.statut === "En attente" ? "var(--warn-fg)" : d.statut === "Acceptée" ? "var(--ok-fg)" : "var(--danger-fg)", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{d.statut}</span>
                  </div>
                  {d.statut === "En attente" && (
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => majDemande(d.id, "Acceptée")} style={{ background: "#3ECB84", color: "#0A2647", border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>Accepter</button>
                      <button onClick={() => majDemande(d.id, "Refusée")} style={{ background: "none", border: "1px solid var(--border)", color: "var(--muted)", borderRadius: 6, padding: "6px 14px", fontSize: 11.5, cursor: "pointer" }}>Refuser</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}

      {showVerifAgent && <VerifierReferenceModal data={data} compteClient={null} onClose={() => setShowVerifAgent(false)} />}

      {ongletActif === "express" && (
        demandesExpress.length === 0 ? (
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 30, textAlign: "center", color: "var(--muted)", fontSize: 13.5 }}>Aucune demande de livraison express en attente.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {demandesExpress.map((c) => {
              const client = clientsById[c.clientAccountId];
              return (
                <div key={c.tracking} style={{ background: "var(--warn-bg)", border: "1px solid var(--warn-border)", borderRadius: 12, padding: "14px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>⚡ {c.tracking} — {client ? `${client.prenom} ${client.nom}` : c.destinataire}</div>
                      <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>
                        Livraison express 72 h · {fmtGNF((c.demandeExpress.montant || 0) * (LIVE_RATES.GNF || CURRENCIES.GNF))} · {c.poids} kg
                        {c.demandeExpress.date ? ` · demandé le ${new Date(c.demandeExpress.date).toLocaleDateString("fr-FR")}` : ""}
                      </div>
                      {c.demandeExpress.adresse && <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>Adresse : {c.demandeExpress.adresse}</div>}
                    </div>
                    <span style={{ background: "var(--surface2)", color: "var(--warn-fg)", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>En attente</span>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => deciderExpress(c, true)} style={{ background: "#16A163", color: "#fff", border: "none", borderRadius: 6, padding: "7px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Accepter</button>
                    <button onClick={() => deciderExpress(c, false)} style={{ background: "none", border: "1px solid var(--border)", color: "var(--muted)", borderRadius: 6, padding: "7px 14px", fontSize: 12, cursor: "pointer" }}>Refuser</button>
                  </div>
                  <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 8 }}>Le client reçoit une notification dans son espace dès votre décision.</div>
                </div>
              );
            })}
          </div>
        )
      )}

      {preAlerteEnCours && (
        <TraiterPreAlerteModal
          preAlerte={preAlerteEnCours}
          client={clientsById[preAlerteEnCours.clientAccountId]}
          tarifs={data.receptionTarifs}
          onValider={(saisie) => validerPreAlerte(preAlerteEnCours, saisie)}
          onClose={() => setPreAlerteEnCours(null)}
        />
      )}

      {ongletActif === "signalements" && (
        signalementsOuverts.length === 0 ? (
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 30, textAlign: "center", color: "var(--muted)", fontSize: 13.5 }}>Aucun signalement ouvert.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {signalementsOuverts.map((s) => (
              <div key={s.id} style={{ background: "var(--warn-bg)", border: "1px solid var(--warn-border)", borderRadius: 12, padding: "14px 16px" }}>
                <div style={{ fontSize: 12.5, color: "var(--warn-fg)", marginBottom: 8 }}>
                  ⚠️ <strong>{s.colis.tracking}</strong> — {s.colis.destinataire} ({new Date(s.dateCreation).toLocaleDateString("fr-FR")})
                  <div style={{ color: "var(--text)", marginTop: 4 }}>{s.message}</div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <input value={reponsesSignalement[s.id] || ""} onChange={(e) => setReponsesSignalement((r) => ({ ...r, [s.id]: e.target.value }))} placeholder="Votre réponse au client..." style={{ ...inputStyle, flex: 1, minWidth: 180, marginBottom: 0 }} />
                  <button onClick={() => repondreSignalement(s.colis, s.id)} style={{ background: "#3ECB84", color: "#0A2647", border: "none", borderRadius: 6, padding: "0 14px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>Répondre & clore</button>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

function ColisView({ data, persist, session, notify, t, initialQuery, ouvrirFormulaire }) {
  const [showForm, setShowForm] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showReception, setShowReception] = useState(false);
  const [showEncaisseGroupe, setShowEncaisseGroupe] = useState(false);
  const [query, setQuery] = useState(initialQuery || "");
  useEffect(() => { if (initialQuery) setQuery(initialQuery); }, [initialQuery]);
  useEffect(() => { if (ouvrirFormulaire) setShowForm(true); }, [ouvrirFormulaire]);
  const deferredQuery = useDeferredValue(query);
  const [selected, setSelected] = useState(null);
  const [modeSelection, setModeSelection] = useState(false);
  const [selectionLot, setSelectionLot] = useState([]);
  const [impressionLot, setImpressionLot] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const isChauffeur = session.role === "Chauffeur";
  const peutCreer = effectivePermission(session, "colis.creer");
  const list = useMemo(() => {
    const q = pourRecherche(deferredQuery);
    return data.colis
      .filter((c) => (isChauffeur ? c.status === "Disponible au retrait" : true))
      .filter((c) => !session.agence || (c.site || "Bambeto") === session.agence)
      .filter((c) => !q || pourRecherche(c.tracking).includes(q) || pourRecherche(c.destinataire).includes(q) || pourRecherche(c.referenceCommande).includes(q) || pourRecherche(c.emplacement).includes(q));
  }, [data.colis, isChauffeur, session.agence, deferredQuery]);
  // Affichage progressif : la recherche porte toujours sur TOUS les colis, seul le nombre de
  // cartes rendues d'un coup est limité, pour que la page reste rapide même avec des milliers
  // de colis en base.
  const [nbColisAffiches, setNbColisAffiches] = useState(TAILLE_PAGE);
  useEffect(() => { setNbColisAffiches(TAILLE_PAGE); }, [deferredQuery]);
  const listeVisible = useMemo(() => list.slice(0, nbColisAffiches), [list, nbColisAffiches]);

  /*
   * Colis disponibles au retrait que le client n'est pas venu chercher.
   *
   * Différent des « colis oubliés » du tableau de bord, qui concernent ceux pas encore expédiés.
   * Ici il s'agit du bout de la chaîne : le colis est à Conakry, le client est prévenu, mais il
   * ne vient pas. Chaque jour qui passe occupe de la place à l'agence et retarde l'encaissement —
   * et le délai de stockage annoncé au client (7 jours par défaut) court déjà.
   */
  const agenceRetraitColis = (data.sites || []).find((s) => s.id === (data.agenceRetraitClient || "site-bambeto")) || (data.sites || [])[0];
  const delaiRetraitJours = (() => {
    const m = String(agenceRetraitColis?.stockage || "").match(/(\d+)/);
    return m ? Number(m[1]) : 7;
  })();

  const aRelancer = useMemo(() => {
    const maintenant = Date.now();
    return (data.colis || [])
      .filter((c) => ["Disponible au retrait"].includes(c.status))
      .map((c) => {
        const etape = [...(c.historique || [])].reverse().find((h) => ["Disponible au retrait"].includes(h.status));
        const depuis = etape ? new Date(etape.date).getTime() : new Date(c.createdAt).getTime();
        return { ...c, joursAttente: Math.floor((maintenant - depuis) / 86400000) };
      })
      .filter((c) => c.joursAttente >= delaiRetraitJours)
      .sort((a, b) => b.joursAttente - a.joursAttente);
  }, [data.colis, delaiRetraitJours]);

  const [relanceEnCours, setRelanceEnCours] = useState(null);

  /** Relance groupée : un rappel court, avec l'adresse et la somme due. */
  async function relancerRetraits() {
    setRelanceEnCours({ total: aRelancer.length, faits: 0, envoyes: 0, echecs: [] });
    let envoyes = 0;
    const echecs = [];
    for (let i = 0; i < aRelancer.length; i++) {
      const c = aRelancer[i];
      const ag = siteRetraitPourColis(c, data);
      const du = c.reste > 0 ? ` Reste à régler : ${fmtGNF(c.reste * (LIVE_RATES.GNF || CURRENCIES.GNF))}.` : "";
      const message = `Bonjour ${c.destinataire}, votre colis Ba-Diaby Express ${c.tracking} vous attend depuis ${c.joursAttente} jours`
        + (ag ? ` à notre agence ${ag.nom} — ${ag.adresse}${ag.horaires ? ` (${ag.horaires})` : ""}.` : ".")
        + du + " Merci de venir le récupérer.";
      if (!c.telephone && !c.expediteurTelephone) echecs.push({ tracking: c.tracking, raison: "pas de numéro" });
      else {
        const { envoyes: n } = await notifierEvenement(data, "relanceRetrait", c, message);
        if (n > 0) envoyes++;
        else echecs.push({ tracking: c.tracking, raison: "envoi automatique indisponible" });
      }
      setRelanceEnCours({ total: aRelancer.length, faits: i + 1, envoyes, echecs: [...echecs] });
    }
    if (envoyes === 0 && echecs.every((e) => e.raison === "envoi automatique indisponible")) {
      setRelanceEnCours(null);
      notify("Envoi automatique indisponible — contactez les clients depuis leur fiche");
    }
  }

  function logActivity(action, detail) { return pushActivity(data, session, action, detail); }
  function toggleSelectionLot(tracking) {
    setSelectionLot((s) => (s.includes(tracking) ? s.filter((t) => t !== tracking) : [...s, tracking]));
  }
  async function imprimerLot(type) {
    setImpressionLot(true);
    const colisSelectionnes = data.colis.filter((c) => selectionLot.includes(c.tracking));
    for (const c of colisSelectionnes) {
      try {
        if (type === "etiquette") await downloadLabel(c);
        else if (type === "ticket") await downloadTicketThermal(c);
        else await downloadInvoice(c, data);
      } catch (e) { console.error(`Échec impression pour ${c.tracking}`, e); }
      await new Promise((r) => setTimeout(r, 400)); // laisse le navigateur traiter chaque téléchargement avant le suivant
    }
    setImpressionLot(false);
    notify(`${colisSelectionnes.length} document(s) généré(s)`);
    setSelectionLot([]);
    setModeSelection(false);
  }
  /*
   * La création d'un colis est la donnée la plus coûteuse à perdre — reconstituer un envoi payé
   * dont on n'a plus le détail est souvent impossible. On attend donc la confirmation réelle de
   * persist() avant d'informer l'agent : si l'enregistrement n'a été que mis en file d'attente
   * locale (pas encore confirmé par le serveur), on le dit clairement plutôt que d'afficher le
   * même message de succès que d'habitude — le bandeau en bas de l'écran et le blocage de
   * fermeture d'onglet prennent le relais tant que ce n'est pas synchronisé.
   */
  async function addColis(colis) {
    const { preAlerteRapprochee, ...colisPropre } = colis;
    const preAlertes = preAlerteRapprochee
      ? (data.preAlertes || []).map((p) => (p.id === preAlerteRapprochee ? { ...p, statut: "Rapproché", colisTracking: colis.tracking } : p))
      : data.preAlertes;
    const resultat = await persist({ ...data, colis: [colisPropre, ...data.colis], preAlertes, activityLog: logActivity("Colis créé", `${colis.tracking} — ${colis.destinataire}`) });
    notify(resultat?.queued
      ? `Colis ${colis.tracking} en attente de synchronisation — ne fermez pas cette page avant confirmation`
      : `Colis ${colis.tracking} enregistré`);
    // Notification automatique selon les préférences (Configuration → Notifications WhatsApp).
    notifierEvenement(data, "enregistrement", colis,
      `Bonjour ${colis.destinataire}, votre colis Ba-Diaby Express ${colis.tracking} a bien été enregistré`
      + `${colis.poids ? ` (${colis.poids} kg)` : ""}. Suivez-le à tout moment sur notre plateforme.`);
    setShowForm(false);
  }
  function importerColisMany(nouveaux) {
    persist({ ...data, colis: [...nouveaux, ...data.colis], activityLog: logActivity("Import Excel", `${nouveaux.length} colis importés`) });
    notify(`${nouveaux.length} colis importés avec succès`);
  }
  function updateColis(tracking, patch) {
    const avant = data.colis.find((c) => c.tracking === tracking);
    const next = { ...data, colis: data.colis.map((c) => (c.tracking === tracking ? { ...c, ...patch } : c)) };
    persist(next);
    const apres = next.colis.find((c) => c.tracking === tracking);
    setSelected(apres);

    // On ne prévient que si quelque chose de visible pour le client a changé : le prix ou le
    // poids. Corriger un numéro de téléphone ou une note interne ne justifie pas un message.
    const prixChange = avant && Math.abs((avant.prix || 0) - (apres.prix || 0)) > 0.005;
    const poidsChange = avant && Number(avant.poids) !== Number(apres.poids);
    if (prixChange || poidsChange) {
      const details = [
        poidsChange ? `poids : ${apres.poids} kg` : null,
        prixChange ? `montant : ${fmtGNF((apres.prix || 0) * (LIVE_RATES.GNF || CURRENCIES.GNF))}` : null,
      ].filter(Boolean).join(", ");
      notifierEvenement(next, "modification", apres,
        `Bonjour ${apres.destinataire}, les informations de votre colis Ba-Diaby Express ${tracking} ont été mises à jour — ${details}.`);
    }
  }
  const [remiseEnCours, setRemiseEnCours] = useState(null);

  /**
   * Enregistre la remise puis passe le colis à « Livré ».
   * Séparé de advance() car cette étape exige une saisie de l'agent.
   */
  function confirmerRemise(tracking, preuve) {
    // Même précaution que pour l'encaissement : on relit l'état réel avant d'agir. Un colis déjà
    // remis par un collègue ne doit pas recevoir une seconde preuve qui écraserait la première.
    const actuel = data.colis.find((c) => c.tracking === tracking);
    if (actuel && actuel.remise) {
      notify?.(`Ce colis a déjà été remis à ${actuel.remise.nom}`);
      setRemiseEnCours(null);
      return;
    }
    const maintenant = new Date().toISOString();
    const next = { ...data, colis: data.colis.map((c) => (c.tracking !== tracking ? c : {
      ...c, status: "Livré", remise: preuve,
      historique: [...(c.historique || []), {
        status: "Livré", date: maintenant,
        utilisateur: preuve.agent, agence: c.site || "Bambeto",
        motif: `Remis à ${preuve.nom}${preuve.typePiece ? ` (${preuve.typePiece}${preuve.numeroPiece ? " " + preuve.numeroPiece : ""})` : ""}`,
      }],
    })) };
    next.activityLog = logActivity("Colis remis", `${tracking} — remis à ${preuve.nom}`);
    persist(next);
    setSelected(next.colis.find((c) => c.tracking === tracking));
    setRemiseEnCours(null);
    notify?.(`Colis ${tracking} remis à ${preuve.nom}`);

    const colisMaj = next.colis.find((c) => c.tracking === tracking);
    if (colisMaj) {
      notifierEvenement(next, "livre", colisMaj,
        `Bonjour ${colisMaj.destinataire}, votre colis Ba-Diaby Express ${tracking} a bien été remis à ${preuve.nom}. Merci de votre confiance !`);
    }
  }

  function advance(tracking) {
    const current = data.colis.find((c) => c.tracking === tracking);
    if (!current) return;
    const idx = STATUSES.indexOf(current.status);
    const nextStatus = STATUSES[Math.min(idx + 1, STATUSES.length - 1)];
    // La remise exige de savoir QUI est venu : on demande avant de marquer « Livré ».
    if (nextStatus === "Livré") { setRemiseEnCours(current); return; }
    const next = { ...data, colis: data.colis.map((c) => {
      if (c.tracking !== tracking) return c;
      // Le code naît quand le colis devient disponible et ne change plus : le client peut avoir
      // reçu le message plusieurs jours avant de venir le chercher.
      const codeRetrait = nextStatus === "Disponible au retrait" && !c.codeRetrait ? genCodeRetrait() : c.codeRetrait;
      return { ...c, status: nextStatus, codeRetrait, historique: [...c.historique, {
        status: nextStatus, date: new Date().toISOString(),
        utilisateur: `${session.prenom} ${session.nom}`, agence: c.site || "Bambeto",
      }] };
    }) };
    next.activityLog = logActivity("Changement de statut", `${tracking} → ${nextStatus}`);
    persist(next);

    // Notification automatique selon les préférences. Chaque statut a son événement ; les statuts
    // sans événement déclaré (Enregistré) ne déclenchent rien.
    const colisMaj = next.colis.find((c) => c.tracking === tracking);
    const evenementParStatut = { "En transit": "expedie", "Arrivé": "arrivee", "Disponible au retrait": "retrait", "Livré": "livre" };
    const evt = evenementParStatut[nextStatus];
    if (evt && colisMaj) {
      const ag = siteRetraitPourColis(colisMaj, data);
      const messages = {
        expedie: `Bonjour ${colisMaj.destinataire}, votre colis Ba-Diaby Express ${tracking} vient de quitter notre entrepôt.`,
        arrivee: `Bonjour ${colisMaj.destinataire}, votre colis Ba-Diaby Express ${tracking} est arrivé en Guinée.`,
        retrait: `Bonjour ${colisMaj.destinataire}, votre colis Ba-Diaby Express ${tracking} est disponible au retrait.`
          + (ag ? ` Retrait à notre agence ${ag.nom} — ${ag.adresse}${ag.horaires ? ` (${ag.horaires})` : ""}.` : "")
          + (colisMaj.reste > 0 ? ` Reste à régler : ${fmtGNF(colisMaj.reste * (LIVE_RATES.GNF || CURRENCIES.GNF))}.` : "")
          + (colisMaj.codeRetrait ? ` Votre code de retrait : ${colisMaj.codeRetrait} — présentez-le à l’agence.` : ""),
        livre: `Bonjour ${colisMaj.destinataire}, votre colis Ba-Diaby Express ${tracking} vous a bien été remis. Merci de votre confiance !`,
      };
      notifierEvenement(next, evt, colisMaj, messages[evt]);
    }
    if (data.notificationSettings?.ouvertureAutoWhatsApp && current.telephone) {
      const msg = `Bonjour ${current.destinataire}, votre colis Ba-Diaby Express (${tracking}) est maintenant : ${nextStatus}. Merci de votre confiance.`;
      window.open(waLink(current.telephone, msg), "_blank");
      notify("Statut mis à jour — WhatsApp ouvert, il ne reste qu’à envoyer");
    } else {
      notify("Statut mis à jour — pensez à notifier le client via WhatsApp");
    }
    setSelected(next.colis.find((c) => c.tracking === tracking));
  }
  /*
   * Litiges : colis endommagé ou perdu.
   *
   * Volontairement séparé du statut de livraison. Un colis abîmé peut tout de même être remis au
   * client (avec un geste commercial), et un colis perdu doit garder sa trace plutôt que d'être
   * « annulé » — ce qui aurait effacé la vente et faussé la comptabilité. Le litige est donc une
   * information supplémentaire, avec sa propre résolution et son éventuelle indemnité.
   */
  function declarerLitige(tracking, type, description) {
    const maintenant = new Date().toISOString();
    const next = { ...data, colis: data.colis.map((c) => (c.tracking !== tracking ? c : {
      ...c,
      litige: { type, description, date: maintenant, statut: "Ouvert",
                par: `${session.prenom} ${session.nom}`.trim() || session.identifiant },
      historique: [...(c.historique || []), { status: c.status, date: maintenant,
        utilisateur: `${session.prenom} ${session.nom}`.trim(), agence: c.site || "Bambeto",
        motif: `Litige déclaré : ${type === "perdu" ? "colis perdu" : "colis endommagé"}${description ? ` — ${description}` : ""}` }],
    })) };
    next.activityLog = logActivity(type === "perdu" ? "Colis déclaré perdu" : "Colis déclaré endommagé", `${tracking}${description ? ` — ${description}` : ""}`);
    persist(next);
    notify(type === "perdu" ? "Colis déclaré perdu" : "Colis déclaré endommagé");
    setSelected(next.colis.find((c) => c.tracking === tracking));
  }

  function resoudreLitige(tracking, resolution, indemniteEUR) {
    const maintenant = new Date().toISOString();
    const next = { ...data, colis: data.colis.map((c) => (c.tracking !== tracking ? c : {
      ...c,
      litige: { ...c.litige, statut: "Résolu", resolution, indemnite: Number(indemniteEUR) || 0,
                dateResolution: maintenant,
                resoluPar: `${session.prenom} ${session.nom}`.trim() || session.identifiant },
    })) };
    next.activityLog = logActivity("Litige résolu", `${tracking} — ${resolution}${indemniteEUR > 0 ? ` · indemnité ${fmt(indemniteEUR, "EUR")}` : ""}`);
    persist(next);
    notify("Litige résolu");
    setSelected(next.colis.find((c) => c.tracking === tracking));
  }

  function annuler(tracking, motif) {
    const next = { ...data, colis: data.colis.map((c) => {
      if (c.tracking !== tracking) return c;
      return { ...c, status: "Annulé", historique: [...c.historique, {
        status: "Annulé", date: new Date().toISOString(),
        utilisateur: `${session.prenom} ${session.nom}`, agence: c.site || "Bambeto", motif,
      }] };
    }) };
    next.activityLog = logActivity("Colis annulé", `${tracking}${motif ? ` — ${motif}` : ""}`);
    persist(next);
    notify("Colis annulé");
    setSelected(next.colis.find((c) => c.tracking === tracking));
  }
  function refuser(tracking, motif) {
    const next = { ...data, colis: data.colis.map((c) => {
      if (c.tracking !== tracking) return c;
      return { ...c, status: "Refusé", retour: { motif, date: new Date().toISOString(), statutRetour: "En attente de décision" }, historique: [...c.historique, {
        status: "Refusé", date: new Date().toISOString(),
        utilisateur: `${session.prenom} ${session.nom}`, agence: c.site || "Bambeto", motif,
      }] };
    }) };
    next.activityLog = logActivity("Colis refusé par le destinataire", `${tracking}${motif ? ` — ${motif}` : ""}`);
    persist(next);
    notify("Colis marqué comme refusé");
    setSelected(next.colis.find((c) => c.tracking === tracking));
  }
  function majRetour(tracking, statutRetour) {
    const next = { ...data, colis: data.colis.map((c) => (c.tracking === tracking ? { ...c, retour: { ...c.retour, statutRetour } } : c)) };
    next.activityLog = logActivity("Suivi retour mis à jour", `${tracking} — ${statutRetour}`);
    persist(next);
    setSelected(next.colis.find((c) => c.tracking === tracking));
  }
  function remove(tracking) { persist({ ...data, colis: data.colis.filter((c) => c.tracking !== tracking), activityLog: logActivity("Colis supprimé", tracking) }); setSelected(null); }
  /**
   * Encaissement groupé : le client se présente au comptoir avec plusieurs colis et règle une
   * seule somme. Elle est répartie automatiquement sur les colis sélectionnés, du plus ancien au
   * plus récent, jusqu'à épuisement. Chaque colis reçoit sa propre ligne de paiement, si bien que
   * la comptabilité et les reçus restent exacts colis par colis.
   */
  function encaisserGroupe(trackings, montantEUR, mode, montantSaisi, deviseSaisie, details) {
    const cibles = data.colis
      .filter((c) => trackings.includes(c.tracking))
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const duTotal = cibles.reduce((s, c) => s + Math.max(+(c.prix - c.paye).toFixed(2), 0), 0);
    let restant = Math.min(Math.max(montantEUR, 0), duTotal);
    const ajuste = Math.abs(restant - montantEUR) > 0.005;
    const horodatage = new Date().toISOString();
    const repartition = {};

    cibles.forEach((c) => {
      if (restant <= 0.005) return;
      const du = Math.max(+(c.prix - c.paye).toFixed(2), 0);
      const part = Math.min(du, restant);
      if (part <= 0.005) return;
      repartition[c.tracking] = +part.toFixed(2);
      restant = +(restant - part).toFixed(2);
    });

    const nbColis = Object.keys(repartition).length;
    if (nbColis === 0) { notify("Aucun montant à encaisser sur ces colis"); return; }

    const next = { ...data, colis: data.colis.map((c) => {
      const part = repartition[c.tracking];
      if (!part) return c;
      const paye = +(c.paye + part).toFixed(2);
      const reste = Math.max(+(c.prix - paye).toFixed(2), 0);
      const paiement = {
        id: `pay${Date.now()}-${c.tracking}`, montant: part,
        montantSaisi: +(part * (LIVE_RATES[deviseSaisie] || CURRENCIES[deviseSaisie] || 1)).toFixed(2),
        deviseSaisie, mode, date: horodatage,
        par: `${session.prenom} ${session.nom}`.trim() || session.identifiant,
        ...(details || {}), groupe: true,
      };
      return { ...c, paye, reste, paiements: [...(c.paiements || []), paiement] };
    }) };
    next.activityLog = logActivity("Encaissement groupé", `${nbColis} colis — ${montantSaisi} ${deviseSaisie} (${mode})`);
    persist(next);
    notify(ajuste
      ? `Réparti sur ${nbColis} colis — limité au solde dû, pensez à rendre la monnaie`
      : `Réparti sur ${nbColis} colis`);
  }

  function encaisser(tracking, montant, mode, montantSaisi, deviseSaisie, details, declarationId) {
    // Un encaissement ne peut jamais être négatif, ni dépasser le montant restant dû : sinon une
    // faute de frappe (un zéro de trop) gonflerait le chiffre d’affaires, car la comptabilité
    // additionne le champ « payé ». Si le client remet davantage, la différence est de la monnaie
    // à lui rendre — pas une recette. On prévient l’agent quand le montant a été ajusté.
    const cible = data.colis.find((c) => c.tracking === tracking);
    const duRestant = cible ? Math.max(+(cible.prix - cible.paye).toFixed(2), 0) : 0;

    /*
     * Protection contre un double encaissement.
     *
     * Deux agents peuvent avoir la même fiche ouverte au comptoir. Si le premier encaisse pendant
     * que le second a encore l'ancien montant à l'écran, le second créditerait une somme déjà
     * reçue — le client paierait deux fois, ou la recette serait comptée en double.
     *
     * `duRestant` est relu ici dans les données à jour, pas dans la copie qu'affichait l'agent :
     * si le colis est déjà soldé, l'opération est refusée et l'agent voit pourquoi.
     */
    if (duRestant <= 0.005) {
      notify?.(`Ce colis est déjà soldé — un autre agent vient peut-être de l’encaisser`);
      return;
    }

    const applique = Math.min(Math.max(montant, 0), duRestant);
    const ajuste = Math.abs(applique - montant) > 0.005;
    const next = { ...data, colis: data.colis.map((c) => {
      if (c.tracking !== tracking) return c;
      const paye = +(c.paye + applique).toFixed(2);
      const reste = Math.max(+(c.prix - paye).toFixed(2), 0);
      const paiement = { id: `pay${Date.now()}`, montant: applique, montantSaisi, deviseSaisie, mode, date: new Date().toISOString(), par: `${session.prenom} ${session.nom}`, reference: details?.reference || "", numeroPayeur: details?.numeroPayeur || "", numeroReceveur: details?.numeroReceveur || "" };
      const declarationsPaiement = declarationId
        ? (c.declarationsPaiement || []).map((d) => (d.id === declarationId ? { ...d, statut: "Confirmé" } : d))
        : c.declarationsPaiement;
      return { ...c, paye, reste, paiements: [...(c.paiements || []), paiement], declarationsPaiement };
    }) };
    next.activityLog = logActivity("Paiement encaissé", `${tracking} — ${montantSaisi} ${deviseSaisie} (${mode})${details?.reference ? ` réf. ${details.reference}` : ""}`);
    persist(next);
    notify(ajuste ? `Encaissement limité au solde dû (${fmt(applique, "EUR")}) — pensez à rendre la monnaie` : "Paiement encaissé");
    const colisPaye = next.colis.find((c) => c.tracking === tracking);
    if (colisPaye) {
      /*
       * Facture par e-mail, si le client en a fourni une adresse.
       *
       * Volontairement silencieux : la plupart de vos clients n'ont pas d'adresse e-mail, et
       * afficher une erreur à chaque encaissement serait pénible. Ceux qui en ont une reçoivent
       * leur facture ; pour les autres, rien ne change.
       */
      const adresse = colisPaye.destinataireEmail || colisPaye.email;
      if (adresse) {
        downloadInvoice(colisPaye, next, { retourner: true })
          .then((piece) => envoyerEmail(
            adresse,
            `Votre facture Ba-Diaby Express — ${tracking}`,
            `<p>Bonjour ${colisPaye.destinataire},</p>
             <p>Nous avons bien reçu votre paiement de <strong>${fmtGNF(applique * (LIVE_RATES.GNF || CURRENCIES.GNF))}</strong>
             pour le colis <strong>${tracking}</strong>.</p>
             <p>${colisPaye.reste > 0
                ? `Reste à régler : <strong>${fmtGNF(colisPaye.reste * (LIVE_RATES.GNF || CURRENCIES.GNF))}</strong>.`
                : "Votre colis est entièrement réglé. Merci de votre confiance !"}</p>
             <p>Votre facture est jointe à ce message.</p>
             <p style="color:#888;font-size:12px">Ba-Diaby Express — Transport de colis Conakry - Monde</p>`,
            piece ? [piece] : []
          ))
          .catch(() => { /* l'encaissement ne doit jamais échouer à cause d'un e-mail */ });
      }
      notifierEvenement(next, "paiement", colisPaye,
        `Bonjour ${colisPaye.destinataire}, nous avons bien reçu votre paiement de `
        + `${fmtGNF(applique * (LIVE_RATES.GNF || CURRENCIES.GNF))} pour le colis ${tracking}.`
        + (colisPaye.reste > 0
            ? ` Reste à régler : ${fmtGNF(colisPaye.reste * (LIVE_RATES.GNF || CURRENCIES.GNF))}.`
            : " Votre colis est entièrement réglé. Merci !"));
    }
    setSelected(next.colis.find((c) => c.tracking === tracking));
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 14 }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontFamily: "'Space Grotesk',sans-serif", color: "var(--text)", fontSize: 27, margin: 0 }}>{t.colis}</h1>
          <p style={{ color: "var(--muted)", fontSize: 14.5, margin: "5px 0 0" }}>{isChauffeur ? "Vos livraisons en cours" : "Enregistrement et suivi des expéditions"}{session.agence && <span style={{ marginLeft: 8, background: "var(--surface2)", color: "var(--info-fg)", padding: "3px 9px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>Agence : {session.agence}</span>}</p>
        </div>
        {/*
          Chaque action a désormais sa propre permission — import Excel, bordereau de réception et
          règlement groupé agissent sur plusieurs colis à la fois, donc plus sensibles que la
          création à l'unité (colis.creer). Non accordées par défaut : à l'administrateur de
          désigner nommément les agences/agents autorisés.
          `minWidth: 0` sur ce conteneur évite qu'il ne force la page entière à défiler
          horizontalement sur mobile : un enfant flex garde par défaut la largeur de son contenu
          non replié pour le calcul de la mise en page, même si `flexWrap` le replie ensuite à
          l'affichage — sans ce correctif, les derniers boutons débordaient hors de l'écran.
        */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", minWidth: 0 }}>
          {effectivePermission(session, "colis.importer_excel") && <button onClick={() => setShowImport(true)} style={{ display: "flex", alignItems: "center", gap: 7, background: "var(--surface)", color: "var(--text)", border: "1.5px solid var(--border)", borderRadius: 9, padding: "12px 18px", fontSize: 14.5, fontWeight: 700, cursor: "pointer" }}><Download size={17} color="var(--info-fg)" style={{ transform: "rotate(180deg)" }} /> Importer Excel</button>}
          {effectivePermission(session, "colis.bordereau_reception") && <button onClick={() => setShowReception(true)} style={{ display: "flex", alignItems: "center", gap: 7, background: "var(--surface)", color: "var(--text)", border: "1.5px solid var(--border)", borderRadius: 9, padding: "12px 18px", fontSize: 14.5, fontWeight: 700, cursor: "pointer" }}><FileStack size={17} color="var(--ok-fg)" /> Bordereau de réception</button>}
          {effectivePermission(session, "colis.reglement_groupe") && <button onClick={() => setShowEncaisseGroupe(true)} style={{ display: "flex", alignItems: "center", gap: 7, background: "var(--surface)", color: "var(--text)", border: "1.5px solid var(--border)", borderRadius: 9, padding: "12px 18px", fontSize: 14.5, fontWeight: 700, cursor: "pointer" }}><DollarSign size={17} color="var(--ok-fg)" /> Règlement groupé</button>}
          {peutCreer && <button onClick={() => setShowAi(true)} style={{ display: "flex", alignItems: "center", gap: 7, background: "var(--surface)", color: "var(--text)", border: "1.5px solid var(--border)", borderRadius: 9, padding: "12px 18px", fontSize: 14.5, fontWeight: 700, cursor: "pointer" }}><Sparkles size={17} color="#8B5CF6" /> Créer par IA</button>}
          {peutCreer && <button onClick={() => setShowForm(true)} style={{ display: "flex", alignItems: "center", gap: 7, background: "var(--brand-solid)", color: "#fff", border: "none", borderRadius: 9, padding: "12px 18px", fontSize: 14.5, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 14px rgba(214,39,63,0.28)" }}><Plus size={17} /> {t.newColis}</button>}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 9, padding: "10px 14px", maxWidth: 380, flex: 1 }}>
          <Search size={17} color="var(--muted)" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`${t.search}...`} style={{ border: "none", outline: "none", flex: 1, fontSize: 15, background: "none", color: "var(--text)" }} />
        </div>
        {peutCreer && (
          <button onClick={() => { setModeSelection((m) => !m); setSelectionLot([]); }} style={{ background: modeSelection ? "var(--brand-solid)" : "var(--surface)", color: modeSelection ? "#fff" : "var(--text)", border: "1.5px solid " + (modeSelection ? "var(--brand-solid)" : "var(--border)"), borderRadius: 9, padding: "10px 16px", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>
            {modeSelection ? "Annuler la sélection" : "Sélectionner plusieurs"}
          </button>
        )}
        <button onClick={() => setShowScanner(true)} style={{ display: "flex", alignItems: "center", gap: 7, background: "var(--surface)", color: "var(--text)", border: "1.5px solid var(--border)", borderRadius: 9, padding: "10px 16px", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>
          <Camera size={16} /> Scanner
        </button>
      </div>
      {aRelancer.length > 0 && (
        <div style={{ background: "var(--warn-bg)", border: "1px solid var(--warn-border)", borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--warn-fg)" }}>
                {aRelancer.length} colis non retiré{aRelancer.length > 1 ? "s" : ""}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>
                Disponibles depuis plus de {delaiRetraitJours} jours à {agenceRetraitColis?.nom || "l’agence"}. Ils occupent de la place et retardent l’encaissement.
              </div>
            </div>
            <button onClick={relancerRetraits} disabled={!!relanceEnCours}
              style={{ display: "flex", alignItems: "center", gap: 6, background: relanceEnCours ? "var(--surface2)" : "#16A163",
                       color: relanceEnCours ? "var(--muted)" : "#fff", border: "none", borderRadius: 8, padding: "9px 16px",
                       fontSize: 12.5, fontWeight: 700, cursor: relanceEnCours ? "default" : "pointer" }}>
              <MessageCircle size={14} /> {relanceEnCours ? `${relanceEnCours.faits}/${relanceEnCours.total}…` : "Relancer par WhatsApp"}
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 5, maxHeight: 190, overflowY: "auto" }}>
            {aRelancer.slice(0, 20).map((c) => (
              <button key={c.tracking} onClick={() => setSelected(c)}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap",
                         background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8,
                         padding: "8px 12px", cursor: "pointer", textAlign: "start" }}>
                <span style={{ fontSize: 12.5, color: "var(--text)", fontWeight: 600 }}>
                  {c.tracking} <span style={{ color: "var(--muted)", fontWeight: 600 }}>· {c.destinataire}</span>
                </span>
                <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  {c.reste > 0 && <span style={{ fontSize: 11.5, color: "var(--danger-fg)", fontWeight: 700 }}>{fmtGNF(c.reste * (LIVE_RATES.GNF || CURRENCIES.GNF))}</span>}
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: c.joursAttente >= delaiRetraitJours * 2 ? "var(--danger-fg)" : "var(--warn-fg)" }}>
                    {c.joursAttente} j
                  </span>
                </span>
              </button>
            ))}
            {aRelancer.length > 20 && (
              <div style={{ fontSize: 11.5, color: "var(--muted)", padding: "4px 2px" }}>et {aRelancer.length - 20} autres…</div>
            )}
          </div>

          {relanceEnCours && relanceEnCours.faits === relanceEnCours.total && (
            <div style={{ marginTop: 10, fontSize: 12, color: "var(--text)" }}>
              <strong style={{ color: "var(--ok-fg)" }}>{relanceEnCours.envoyes} relancé{relanceEnCours.envoyes > 1 ? "s" : ""}</strong>
              {relanceEnCours.echecs.length > 0 && <> · <strong style={{ color: "var(--warn-fg)" }}>{relanceEnCours.echecs.length} à contacter autrement</strong></>}
              <button onClick={() => setRelanceEnCours(null)} style={{ marginInlineStart: 10, background: "none", border: "none", color: "var(--info-fg)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Fermer</button>
            </div>
          )}
        </div>
      )}

      {showScanner && (
        <ScannerModal onClose={() => setShowScanner(false)} onScan={(raw) => {
          const tracking = extractTrackingFromScan(raw);
          const trouve = data.colis.find((c) => c.tracking === tracking);
          setShowScanner(false);
          if (trouve) { setSelected(trouve); notify(`Colis ${tracking} trouvé`); }
          else { setQuery(tracking); notify(`Aucun colis trouvé pour "${tracking}" — recherche lancée`); }
        }} />
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 18, marginBottom: modeSelection && selectionLot.length > 0 ? 90 : 0 }}>
        {listeVisible.map((c) => <TicketCard key={c.tracking} colis={c} onOpen={() => (modeSelection ? toggleSelectionLot(c.tracking) : setSelected(c))} selectionMode={modeSelection} checked={selectionLot.includes(c.tracking)} />)}
        {list.length === 0 && <div style={{ color: "var(--muted)", fontSize: 13.5 }}>Aucun colis à afficher.</div>}
        {list.length > listeVisible.length && (
          <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", justifyContent: "center", gap: 12, padding: "6px 0", flexWrap: "wrap" }}>
            <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{listeVisible.length} affichés sur {list.length}</span>
            <button onClick={() => setNbColisAffiches((n) => n + TAILLE_PAGE)} style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: 8, padding: "7px 16px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
              Afficher {Math.min(TAILLE_PAGE, list.length - listeVisible.length)} de plus
            </button>
            <button onClick={() => setNbColisAffiches(list.length)} style={{ background: "none", border: "none", color: "var(--info-fg)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
              Tout afficher
            </button>
          </div>
        )}
      </div>
      {modeSelection && selectionLot.length > 0 && (
        <div style={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", background: "#0A2647", borderRadius: 14, padding: "14px 20px", display: "flex", alignItems: "center", gap: 14, boxShadow: "0 8px 30px rgba(0,0,0,0.3)", zIndex: 50, flexWrap: "wrap", justifyContent: "center" }}>
          <span style={{ color: "#fff", fontSize: 13, fontWeight: 700 }}>{selectionLot.length} sélectionné{selectionLot.length > 1 ? "s" : ""}</span>
          <button onClick={() => imprimerLot("etiquette")} disabled={impressionLot} style={{ background: "#3ECB84", color: "#0A2647", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>{impressionLot ? "Génération…" : "Étiquettes"}</button>
          <button onClick={() => imprimerLot("ticket")} disabled={impressionLot} style={{ background: "#5B8DEF", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>{impressionLot ? "Génération…" : "Tickets thermiques"}</button>
          <button onClick={() => imprimerLot("facture")} disabled={impressionLot} style={{ background: "var(--surface2)", color: "#fff", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>{impressionLot ? "Génération…" : "Factures A4"}</button>
        </div>
      )}
      {showForm && <ColisForm remiseVolumeConfig={data.remiseVolume} repertoire={data.repertoire} onClose={() => setShowForm(false)} onSave={addColis} existingColis={data.colis} categories={data.categories || []} session={session} sites={data.sites} partenaires={(data.users || []).filter((u) => u.role === "Partenaire")} clientAccounts={data.clientAccounts || []} preAlertes={data.preAlertes || []} notify={notify} />}
      {showAi && <AiColisModal onClose={() => setShowAi(false)} onCreate={addColis} data={data} session={session} />}
      {showImport && <ImportExcelModal onClose={() => setShowImport(false)} onImportMany={importerColisMany} data={data} session={session} />}
      {remiseEnCours && <RemiseColisModal colis={remiseEnCours} session={session}
        onConfirmer={(preuve) => confirmerRemise(remiseEnCours.tracking, preuve)}
        onRenvoyerCode={(c) => {
          notifierEvenement(data, "retrait", c,
            `Bonjour ${c.destinataire}, votre code de retrait pour le colis ${c.tracking} est ${c.codeRetrait}. Présentez-le à notre agence.`);
          notify?.("Code renvoyé au client");
        }}
        onClose={() => setRemiseEnCours(null)} />}
      {showEncaisseGroupe && <EncaisserGroupeModal data={data} onEncaisser={encaisserGroupe} onClose={() => setShowEncaisseGroupe(false)} />}
      {showReception && <ReceptionBordereauModal onClose={() => setShowReception(false)} data={data} persist={persist} notify={notify} session={session} />}
      {selected && <ColisDetail colis={selected} onClose={() => setSelected(null)} onAdvance={() => advance(selected.tracking)} onDelete={() => remove(selected.tracking)} onCancel={(motif) => annuler(selected.tracking, motif)} onRefuser={(motif) => refuser(selected.tracking, motif)} onDeclarerLitige={(t, d) => declarerLitige(selected.tracking, t, d)} onResoudreLitige={(r, i) => resoudreLitige(selected.tracking, r, i)} onMajRetour={(statutRetour) => majRetour(selected.tracking, statutRetour)} onUpdate={(patch) => updateColis(selected.tracking, patch)} onEncaisser={(montant, mode, montantSaisi, deviseSaisie, details, declarationId) => encaisser(selected.tracking, montant, mode, montantSaisi, deviseSaisie, details, declarationId)} canManage={!isChauffeur} isAdmin={session.role === "Administrateur"} isChauffeur={isChauffeur} data={data} session={session} notify={notify} />}
    </div>
  );
}


ColisView = memo(ColisView);
function genBordereauNumero(bordereaux) {
  const d = new Date();
  const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const seq = String(1000 + (bordereaux || []).length).slice(-4);
  return `BR${ymd}BAD-${seq}`;
}

function BordereauxPage({ data, persist, session, notify }) {
  const [mode, setMode] = useState("liste"); // liste | creation | detail
  const [selectedId, setSelectedId] = useState(null);
  const bordereaux = data.bordereaux || [];

  /*
   * Stock en attente d'expédition, par entrepôt.
   *
   * Un colis « Enregistré » est physiquement dans un entrepôt et n'est pas encore parti :
   *   - à l'import (achat en ligne), il attend dans le pays d'origine (France, Maroc…) ;
   *   - à l'export, il attend à Conakry.
   * C'est cette information qui dit quand affréter : partir trop tôt coûte en marge, partir trop
   * tard coûte en clients. L'ancienneté du plus vieux colis est le signal le plus parlant.
   */
  const stockEntrepots = useMemo(() => {
    const maintenant = Date.now();
    const parEntrepot = {};
    (data.colis || []).forEach((c) => {
      if (c.status !== "Enregistré") return;
      const cle = c.direction === "import" ? (c.pays || "FR") : "GN";
      const pays = COUNTRIES.find((x) => x.code === cle);
      if (!parEntrepot[cle]) {
        parEntrepot[cle] = { code: cle, nom: pays ? pays.city : cle, colis: 0, poids: 0, valeur: 0,
                             plusAncienJours: 0, tranches: { recent: 0, moyen: 0, vieux: 0 } };
      }
      const e = parEntrepot[cle];
      const jours = Math.floor((maintenant - new Date(c.createdAt).getTime()) / 86400000);
      e.colis += 1;
      e.poids += Number(c.poids) || 0;
      e.valeur += Number(c.prix) || 0;
      e.plusAncienJours = Math.max(e.plusAncienJours, jours);
      if (jours <= 7) e.tranches.recent += 1;
      else if (jours <= 15) e.tranches.moyen += 1;
      else e.tranches.vieux += 1;
    });
    return Object.values(parEntrepot).sort((a, b) => b.plusAncienJours - a.plusAncienJours);
  }, [data.colis]);
  const selected = bordereaux.find((b) => b.id === selectedId);

  function openDetail(id) { setSelectedId(id); setMode("detail"); }
  function creerBordereau(numero, pays, direction, colisTrackings) {
    const b = { id: `bord-${Date.now()}`, numero, pays, direction, colisTrackings, statut: "Brouillon", dateCreation: new Date().toISOString(), dateModif: new Date().toISOString(), historique: [{ statut: "Brouillon", date: new Date().toISOString(), par: `${session.prenom} ${session.nom}` }] };
    persist({ ...data, bordereaux: [b, ...bordereaux], activityLog: pushActivity(data, session, "Bordereau créé", `${numero} — ${colisTrackings.length} colis`) });
    notify?.(`Bordereau ${numero} créé (Brouillon)`);
    setSelectedId(b.id); setMode("detail");
  }
  function updateBordereau(id, patch) {
    persist({ ...data, bordereaux: bordereaux.map((b) => (b.id === id ? { ...b, ...patch, dateModif: new Date().toISOString() } : b)) });
  }
  function avancerStatut(id) {
    const b = bordereaux.find((x) => x.id === id);
    if (!b) return;
    const cur = normalizeBordereauStatut(b.statut);
    const idx = BORDEREAU_STATUSES.indexOf(cur);
    const next = BORDEREAU_STATUSES[Math.min(idx + 1, BORDEREAU_STATUSES.length - 1)];
    const entry = { statut: next, date: new Date().toISOString(), par: `${session.prenom} ${session.nom}` };
    persist({
      ...data,
      bordereaux: bordereaux.map((x) => (x.id === id ? { ...x, statut: next, historique: [...(x.historique || []), entry], dateModif: new Date().toISOString() } : x)),
      activityLog: pushActivity(data, session, "Statut du bordereau modifié", `${b.numero} → ${next}`),
    });
    notify?.(`Bordereau ${b.numero} : ${next}`);
  }

  if (mode === "creation") return <BordereauCreation data={data} session={session} onCancel={() => setMode("liste")} onCreate={creerBordereau} />;
  if (mode === "detail" && selected) return <BordereauDetail bordereau={selected} data={data} persist={persist} session={session} notify={notify} onBack={() => setMode("liste")} onUpdate={(patch) => updateBordereau(selected.id, patch)} onAvancerStatut={() => avancerStatut(selected.id)} />;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 18 }}>
        <div>
          <h1 style={{ fontFamily: "'Space Grotesk',sans-serif", color: "var(--text)", fontSize: 24, margin: 0 }}>Bordereaux</h1>
          <p style={{ color: "var(--muted)", fontSize: 13.5, margin: "4px 0 0" }}>Choisissez précisément quels colis expédier dans chaque bordereau.</p>
        </div>
        {effectivePermission(session, "bordereaux.creer") && <button onClick={() => setMode("creation")} style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--brand-solid)", color: "#fff", border: "none", borderRadius: 8, padding: "10px 16px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}><Plus size={16} /> Nouveau bordereau</button>}
      </div>

      {stockEntrepots.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>En attente d’expédition</div>
          <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 10 }}>
            Colis reçus en entrepôt et pas encore partis. L’ancienneté du plus vieux colis indique s’il est temps d’affréter.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))", gap: 12 }}>
            {stockEntrepots.map((e) => {
              const alerte = e.plusAncienJours >= 30 ? "danger" : e.plusAncienJours >= 15 ? "warn" : "ok";
              const fond = alerte === "danger" ? "var(--danger-bg)" : alerte === "warn" ? "var(--warn-bg)" : "var(--surface)";
              const bord = alerte === "danger" ? "var(--danger-border)" : alerte === "warn" ? "var(--warn-border)" : "var(--border)";
              const teinte = alerte === "danger" ? "var(--danger-fg)" : alerte === "warn" ? "var(--warn-fg)" : "var(--ok-fg)";
              return (
                <div key={e.code} style={{ background: fond, border: "1px solid " + bord, borderRadius: 12, padding: "14px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{FLAGS[e.code] || ""} {e.nom}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: teinte }}>
                      {e.plusAncienJours === 0 ? "aujourd’hui" : `${e.plusAncienJours} j`}
                    </span>
                  </div>
                  <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 22, fontWeight: 700, color: "var(--text)" }}>
                    {e.colis} colis
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                    {e.poids.toFixed(1)} kg · {fmtGNF(e.valeur * (LIVE_RATES.GNF || CURRENCIES.GNF))}
                  </div>
                  <div style={{ display: "flex", gap: 5, marginTop: 10, flexWrap: "wrap" }}>
                    {[["≤ 7 j", e.tranches.recent, "var(--ok-fg)"],
                      ["8–15 j", e.tranches.moyen, "var(--warn-fg)"],
                      ["> 15 j", e.tranches.vieux, "var(--danger-fg)"]].map(([label, n, coul]) => (
                      n > 0 ? (
                        <span key={label} style={{ background: "var(--surface2)", color: coul, borderRadius: 20, padding: "2px 9px", fontSize: 10.5, fontWeight: 700 }}>
                          {n} · {label}
                        </span>
                      ) : null
                    ))}
                  </div>
                  {alerte !== "ok" && (
                    <div style={{ fontSize: 10.5, color: teinte, marginTop: 9, fontWeight: 600 }}>
                      {alerte === "danger" ? "Des colis attendent depuis plus d’un mois." : "Certains colis attendent depuis plus de deux semaines."}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {bordereaux.map((b) => {
          const colisInclus = data.colis.filter((c) => b.colisTrackings.includes(c.tracking));
          const poids = colisInclus.reduce((s, c) => s + c.poids, 0);
          const montant = colisInclus.reduce((s, c) => s + c.prix, 0);
          const statut = normalizeBordereauStatut(b.statut);
          const st = BORDEREAU_STATUS_STYLE[statut];
          return (
            <button key={b.id} onClick={() => openDetail(b.id)} style={{ textAlign: "start", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 18px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{b.numero}</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>{routeLabel(b.pays, b.direction)} · {b.colisTrackings.length} colis · {poids.toFixed(1)} kg</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{fmt(montant, "EUR")}</div>
                <span style={{ background: st.bg, color: st.fg, padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{statut}</span>
              </div>
            </button>
          );
        })}
        {bordereaux.length === 0 && <div style={{ color: "var(--muted)", fontSize: 13 }}>Aucun bordereau créé pour le moment.</div>}
      </div>
    </div>
  );
}


BordereauxPage = memo(BordereauxPage);
function BordereauCreation({ data, session, onCancel, onCreate }) {
  const [pays, setPays] = useState("FR");
  const [direction, setDirection] = useState("export");
  const [selectedTrackings, setSelectedTrackings] = useState([]);
  const country = COUNTRIES.find((c) => c.code === pays);

  const dejaInclus = new Set((data.bordereaux || []).filter((b) => normalizeBordereauStatut(b.statut) !== "Livré").flatMap((b) => b.colisTrackings));
  const eligibles = data.colis.filter((c) => c.pays === pays && (c.direction || "export") === direction && c.status !== "Livré" && c.status !== "Annulé" && !dejaInclus.has(c.tracking) && (!session?.agence || (c.site || "Bambeto") === session.agence));

  function toggle(tracking) {
    setSelectedTrackings((list) => (list.includes(tracking) ? list.filter((t) => t !== tracking) : [...list, tracking]));
  }
  function toutSelectionner() { setSelectedTrackings(eligibles.map((c) => c.tracking)); }
  function creer() {
    if (selectedTrackings.length === 0) return;
    onCreate(genBordereauNumero(data.bordereaux || []), pays, direction, selectedTrackings);
  }

  return (
    <div>
      <ConfigPageHeader title="Nouveau bordereau" desc="Sélectionnez la route puis choisissez précisément les colis à expédier." onBack={onCancel} />
      <div style={{ display: "flex", gap: 14, marginBottom: 18, flexWrap: "wrap" }}>
        <div style={{ width: 260 }}>
          <Field label="Pays"><select value={pays} onChange={(e) => { setPays(e.target.value); setSelectedTrackings([]); }} style={inputStyle}>{COUNTRIES.filter((c) => c.code !== "GN").map((c) => <option key={c.code} value={c.code}>{FLAGS[c.code]} {c.name}</option>)}</select></Field>
        </div>
        <div style={{ width: 260 }}>
          <Field label="Sens">
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => { setDirection("export"); setSelectedTrackings([]); }} style={{ ...toggleBtn, ...(direction === "export" ? toggleActive : {}) }}>Conakry → {country?.city}</button>
              <button onClick={() => { setDirection("import"); setSelectedTrackings([]); }} style={{ ...toggleBtn, ...(direction === "import" ? toggleActive : {}) }}>{country?.city} → Conakry</button>
            </div>
          </Field>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontSize: 13, color: "var(--text)", fontWeight: 600 }}>{selectedTrackings.length} / {eligibles.length} colis sélectionnés</div>
        <button onClick={toutSelectionner} style={{ background: "none", border: "none", color: "var(--info-fg)", fontSize: 12.5, cursor: "pointer" }}>Tout sélectionner</button>
      </div>

      <div style={{ background: "var(--surface)", borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden", marginBottom: 18 }}>
        {eligibles.length === 0 ? (
          <div style={{ padding: 20, color: "var(--muted)", fontSize: 13 }}>Aucun colis en attente sur cette route (ou déjà inclus dans un autre bordereau en cours).</div>
        ) : eligibles.map((c) => (
          <label key={c.tracking} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderTop: "1px solid var(--border)", cursor: "pointer" }}>
            <input type="checkbox" checked={selectedTrackings.includes(c.tracking)} onChange={() => toggle(c.tracking)} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{c.tracking} — {c.destinataire}</div>
              <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{c.status} · {c.poids} kg</div>
            </div>
            <div style={{ fontSize: 13, color: "var(--text)" }}>{fmt(c.prix, "EUR")}</div>
          </label>
        ))}
      </div>

      <button onClick={creer} disabled={selectedTrackings.length === 0} style={{ background: selectedTrackings.length ? "var(--brand-solid)" : "var(--surface2)", color: selectedTrackings.length ? "#fff" : "var(--muted)", border: "none", borderRadius: 8, padding: "11px 22px", fontSize: 13.5, fontWeight: 700, cursor: selectedTrackings.length ? "pointer" : "not-allowed" }}>
        Créer le bordereau ({selectedTrackings.length} colis)
      </button>
    </div>
  );
}

function BordereauDetail({ bordereau, data, persist, session, notify, onBack, onUpdate, onAvancerStatut }) {
  const [modification, setModification] = useState(false);
  const [genPdf, setGenPdf] = useState(false);
  const [depenseForm, setDepenseForm] = useState(null);
  const [devise, setDevise] = useState("GNF");
  const country = COUNTRIES.find((c) => c.code === bordereau.pays);
  const colisDuBordereau = data.colis.filter((c) => bordereau.colisTrackings.includes(c.tracking));
  /*
   * Les colis livrés sortent de la vue courante du bordereau : leur acheminement est terminé,
   * ils n'ont plus à encombrer la liste de travail de l'agent. Ils restent rattachés au
   * bordereau (l'historique et les documents demeurent complets) et peuvent être réaffichés
   * d'un clic.
   */
  const colisLivres = colisDuBordereau.filter((c) => c.status === "Livré");
  const [voirLivres, setVoirLivres] = useState(false);
  const colisInclus = voirLivres ? colisDuBordereau : colisDuBordereau.filter((c) => c.status !== "Livré");
  const poids = colisInclus.reduce((s, c) => s + c.poids, 0);
  const montant = colisInclus.reduce((s, c) => s + c.prix, 0);
  const statutActuel = normalizeBordereauStatut(bordereau.statut);
  const stIdx = BORDEREAU_STATUSES.indexOf(statutActuel);
  const estFinal = stIdx === BORDEREAU_STATUSES.length - 1;

  const dejaInclusAilleurs = new Set((data.bordereaux || []).filter((b) => b.id !== bordereau.id && normalizeBordereauStatut(b.statut) !== "Livré").flatMap((b) => b.colisTrackings));
  const ajoutables = data.colis.filter((c) => c.pays === bordereau.pays && (c.direction || "export") === bordereau.direction && c.status !== "Livré" && c.status !== "Annulé" && !bordereau.colisTrackings.includes(c.tracking) && !dejaInclusAilleurs.has(c.tracking));

  /*
   * Avancement des colis du bordereau.
   *
   * Rien ne change tout seul : un colis enregistré reste « Reçu à l'entrepôt » tant qu'un agent
   * n'a pas confirmé l'étape suivante. L'agent choisit les colis concernés (tous par défaut,
   * car un bordereau part généralement en entier) et confirme explicitement — ce qui met à jour
   * l'espace client immédiatement.
   */
  const [selectionAvance, setSelectionAvance] = useState([]);
  const [confirmation, setConfirmation] = useState(null);
  const [prevenir, setPrevenir] = useState(true);
  const [envoiWa, setEnvoiWa] = useState(null);

  const ETAPES_COLIS = [
    { cle: "En transit", bouton: "Marquer expédiés", vuClient: "Expédié", depuis: ["Enregistré"] },
    { cle: "Arrivé", bouton: "Marquer arrivés en Guinée", vuClient: "Arrivé en Guinée", depuis: ["Enregistré", "En transit"] },
    { cle: "Disponible au retrait", bouton: "Marquer disponibles au retrait", vuClient: "Disponible pour retrait", depuis: ["Arrivé"] },
  ];

  function basculerSelection(tracking) {
    setSelectionAvance((s) => (s.includes(tracking) ? s.filter((t) => t !== tracking) : [...s, tracking]));
  }

  /**
   * Message envoyé au client selon l'étape. Court et utile : le client doit comprendre en une
   * ligne où en est son colis, et savoir quoi faire s'il peut venir le chercher.
   */
  function messagePourEtape(colis, etape) {
    const base = `Bonjour ${colis.destinataire}, votre colis Ba-Diaby Express ${colis.tracking}`;
    if (etape.cle === "En transit") return `${base} vient de quitter notre entrepôt. Nous vous préviendrons dès son arrivée en Guinée.`;
    if (etape.cle === "Arrivé") return `${base} est arrivé en Guinée. Il sera bientôt disponible au retrait.`;
    const ag = siteRetraitPourColis(colis, data);
    const ou = ag ? ` Retrait à notre agence ${ag.nom} — ${ag.adresse}${ag.horaires ? ` (${ag.horaires})` : ""}.` : "";
    const du = colis.reste > 0 ? ` Reste à régler : ${fmtGNF(colis.reste * (LIVE_RATES.GNF || CURRENCIES.GNF))}.` : "";
    return `${base} est disponible au retrait.${ou}${du}`;
  }

  /**
   * Prévenir les clients par WhatsApp après un changement d'étape.
   *
   * Sans cela, l'agent devait ouvrir chaque colis un par un : sur un bordereau de trente colis,
   * personne ne le fait, et le service ne rend pas le bénéfice attendu. L'envoi est séquentiel
   * pour ne pas saturer Twilio, et le résultat est détaillé (envoyés / non joignables) plutôt
   * que masqué derrière un message vague.
   */
  async function prevenirClients(colisConcernes, etape) {
    setEnvoiWa({ total: colisConcernes.length, faits: 0, envoyes: 0, echecs: [] });
    let envoyes = 0;
    const echecs = [];
    for (let i = 0; i < colisConcernes.length; i++) {
      const c = colisConcernes[i];
      // On passe par notifierEvenement pour que les réglages (Configuration → Notifications
      // WhatsApp) soient respectés : l'agence peut choisir de prévenir aussi l'expéditeur,
      // ou de désactiver complètement une étape.
      const evt = { "En transit": "expedie", "Arrivé": "arrivee", "Disponible au retrait": "retrait" }[etape.cle] || "arrivee";
      if (!c.telephone && !c.expediteurTelephone) { echecs.push({ tracking: c.tracking, raison: "pas de numéro" }); }
      else {
        const { envoyes: n } = await notifierEvenement(data, evt, c, messagePourEtape(c, etape));
        if (n > 0) envoyes++;
        else echecs.push({ tracking: c.tracking, raison: "envoi automatique indisponible" });
      }
      setEnvoiWa({ total: colisConcernes.length, faits: i + 1, envoyes, echecs: [...echecs] });
    }
    return { envoyes, echecs };
  }

  async function appliquerEtape(etape) {
    const cibles = selectionAvance.length ? selectionAvance : colisInclus.map((c) => c.tracking);
    const maintenant = new Date().toISOString();
    let modifies = 0;
    const concernes = [];
    const colisMaj = data.colis.map((c) => {
      if (!cibles.includes(c.tracking) || c.status === etape.cle) return c;
      if (["Annulé", "Refusé", "Livré"].includes(c.status)) return c;
      modifies++;
      concernes.push(c);
      return { ...c, status: etape.cle, historique: [...(c.historique || []), { status: etape.cle, date: maintenant }] };
    });
    if (modifies === 0) { notify?.("Aucun colis à mettre à jour"); setConfirmation(null); return; }
    persist({
      ...data, colis: colisMaj,
      activityLog: pushActivity(data, session, `Colis passés à « ${etape.cle} »`, `${bordereau.numero} — ${modifies} colis`),
    });
    notify?.(`${modifies} colis : ${etape.vuClient}`);
    setSelectionAvance([]);

    if (prevenir) {
      const { envoyes, echecs } = await prevenirClients(concernes, etape);
      // Si RIEN n'est parti et qu'aucun échec n'a de cause précise, c'est que l'envoi automatique
      // n'est pas disponible (Twilio non configuré, ou hors ligne). Inutile d'alarmer l'agent avec
      // une liste d'« échecs » : on referme discrètement, le changement de statut a bien eu lieu.
      const indisponible = envoyes === 0 && echecs.every((e) => e.raison === "envoi automatique indisponible");
      if (indisponible) {
        setEnvoiWa(null);
        setConfirmation(null);
        return;
      }
      notify?.(echecs.length === 0
        ? `${envoyes} client${envoyes > 1 ? "s" : ""} prévenu${envoyes > 1 ? "s" : ""} par WhatsApp`
        : `${envoyes} prévenu(s), ${echecs.length} à contacter autrement`);
      return;   // le résultat détaillé reste affiché, l'agent ferme lui-même
    }
    setConfirmation(null);
  }

  function retirer(tracking) { onUpdate({ colisTrackings: bordereau.colisTrackings.filter((t) => t !== tracking) }); }
  function ajouter(tracking) { onUpdate({ colisTrackings: [...bordereau.colisTrackings, tracking] }); }

  async function telechargerPdf() {
    setGenPdf(true);
    try { await downloadRouteManifest(colisInclus, country, bordereau.direction, bordereau, devise); }
    catch (e) { console.error(e); notify?.("Échec de génération du PDF"); }
    setGenPdf(false);
  }
  function envoyerMail() {
    const sujet = `Bordereau ${bordereau.numero} — ${routeLabel(bordereau.pays, bordereau.direction)}`;
    const corps = `Bordereau ${bordereau.numero}\n${routeLabel(bordereau.pays, bordereau.direction)}\n${colisInclus.length} colis, ${poids.toFixed(1)} kg, ${fmt(montant, "EUR")}\n\n` + colisInclus.map((c) => `- ${c.tracking} · ${c.destinataire} · ${c.poids}kg`).join("\n");
    window.open(`mailto:?subject=${encodeURIComponent(sujet)}&body=${encodeURIComponent(corps)}`, "_blank");
  }
  function ajouterDepense() {
    if (!depenseForm?.nom || !depenseForm?.montant) return;
    const entry = { id: `dep${Date.now()}`, type: "Dépense", nom: `${depenseForm.nom} (${bordereau.numero})`, montant: Number(depenseForm.montant) || 0, date: new Date().toISOString() };
    persist({ ...data, depenses: [entry, ...(data.depenses || [])], activityLog: pushActivity(data, session, "Dépense liée à un bordereau", `${bordereau.numero} — ${entry.nom}`) });
    notify?.("Dépense ajoutée");
    setDepenseForm(null);
  }

  return (
    <div>
      <ConfigPageHeader title={`Bordereau ${bordereau.numero}`} desc={routeLabel(bordereau.pays, bordereau.direction)} onBack={onBack} />

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          {BORDEREAU_STATUSES.map((s, i) => (
            <React.Fragment key={s}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, flex: i === 0 || i === BORDEREAU_STATUSES.length - 1 ? "0 0 auto" : 1 }}>
                <div style={{ width: 13, height: 13, borderRadius: "50%", background: i <= stIdx ? "#3ECB84" : "var(--border)", flexShrink: 0 }} />
                <div style={{ fontSize: 10.5, color: i <= stIdx ? "var(--text)" : "var(--muted)", fontWeight: i === stIdx ? 700 : 500, whiteSpace: "nowrap" }}>{s}</div>
              </div>
              {i < BORDEREAU_STATUSES.length - 1 && <div style={{ height: 2, flex: 1, background: i < stIdx ? "#3ECB84" : "var(--border)", marginBottom: 15 }} />}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
        {!estFinal && effectivePermission(session, "bordereaux.valider") && (
          <button onClick={onAvancerStatut} style={{ display: "flex", alignItems: "center", gap: 6, background: "#3D63FF", color: "#fff", border: "none", borderRadius: 8, padding: "10px 16px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
            Statut suivant : {BORDEREAU_STATUSES[stIdx + 1]} <ChevronRight size={14} />
          </button>
        )}
        <button onClick={telechargerPdf} disabled={genPdf} style={{ background: "var(--surface2)", color: "var(--text)", border: "1.5px solid var(--border)", borderRadius: 8, padding: "10px 16px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>{genPdf ? "Génération…" : "Télécharger PDF"}</button>
        <button onClick={envoyerMail} style={{ background: "var(--surface2)", color: "var(--text)", border: "1.5px solid var(--border)", borderRadius: 8, padding: "10px 16px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>Envoyer un mail</button>
        <button onClick={() => setDepenseForm({ nom: "", montant: "" })} style={{ background: "var(--surface2)", color: "var(--text)", border: "1.5px solid var(--border)", borderRadius: 8, padding: "10px 16px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>Ajouter une dépense</button>
        {effectivePermission(session, "bordereaux.modifier") && <button onClick={() => setModification((m) => !m)} style={{ background: "var(--surface2)", color: "var(--text)", border: "1.5px solid var(--border)", borderRadius: 8, padding: "10px 16px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>{modification ? "Terminer la modification" : "Modifier"}</button>}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>Afficher les montants en :</span>
        <select value={devise} onChange={(e) => setDevise(e.target.value)} style={{ ...inputStyle, width: 110, marginBottom: 0 }}>
          {Object.keys(CURRENCIES).map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 14, marginBottom: 20 }}>
        <StatCard label="Colis" value={colisInclus.length} icon={Package} tint="#3D63FF" />
        <StatCard label="Poids total" value={`${poids.toFixed(1)} kg`} icon={Truck} tint="#8B5CF6" />
        <StatCard label="Montant total" value={fmt(montant, devise)} icon={DollarSign} tint="#16A163" />
        <StatCard label="Statut" value={statutActuel} icon={CheckCircle2} tint={BORDEREAU_STATUS_STYLE[statutActuel]?.fg || "#5B8DEF"} />
      </div>

      {colisInclus.length > 0 && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 16, marginBottom: 18 }}>
          <div style={{ fontWeight: 700, color: "var(--text)", fontSize: 14, marginBottom: 4 }}>Faire avancer les colis</div>
          <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 12 }}>
            Chaque étape doit être confirmée par un agent. Le client voit la mise à jour immédiatement.
            {selectionAvance.length === 0
              ? " Aucun colis coché : l'action portera sur les " + colisInclus.length + " colis du bordereau."
              : ` ${selectionAvance.length} colis sélectionné${selectionAvance.length > 1 ? "s" : ""}.`}
          </div>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
            {colisInclus.map((c) => {
              const coche = selectionAvance.includes(c.tracking);
              return (
                <button key={c.tracking} onClick={() => basculerSelection(c.tracking)}
                  style={{ display: "flex", alignItems: "center", gap: 6, background: coche ? "var(--info-bg)" : "var(--surface2)",
                           border: "1px solid " + (coche ? "var(--info-border)" : "var(--border)"), borderRadius: 20,
                           padding: "5px 11px", fontSize: 11.5, color: "var(--text)", cursor: "pointer" }}>
                  {coche && <Check size={11} color="var(--info-fg)" />}
                  {c.tracking}
                  <span style={{ color: "var(--muted)" }}>· {clientStatusLabel(c.status)}</span>
                </button>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {ETAPES_COLIS.map((e) => (
              <button key={e.cle} onClick={() => setConfirmation(e)}
                style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)",
                         borderRadius: 8, padding: "8px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
                {e.bouton}
              </button>
            ))}
          </div>
        </div>
      )}

      {confirmation && (
        <Modal onClose={() => { setConfirmation(null); setEnvoiWa(null); }} title={envoiWa ? "Envoi aux clients" : "Confirmer l’étape"}>
          {envoiWa ? (
            <>
              <div style={{ fontSize: 13.5, color: "var(--text)", marginBottom: 10 }}>
                {envoiWa.faits} / {envoiWa.total} traités · <strong style={{ color: "var(--ok-fg)" }}>{envoiWa.envoyes} prévenus</strong>
                {envoiWa.echecs.length > 0 && <> · <strong style={{ color: "var(--warn-fg)" }}>{envoiWa.echecs.length} à contacter autrement</strong></>}
              </div>
              <div style={{ height: 6, background: "var(--surface2)", borderRadius: 20, overflow: "hidden", marginBottom: 14 }}>
                <div style={{ width: `${envoiWa.total ? (envoiWa.faits / envoiWa.total) * 100 : 0}%`, height: "100%", background: "var(--ok-fg)", transition: "width .2s" }} />
              </div>
              {envoiWa.echecs.length > 0 && (
                <div style={{ background: "var(--warn-bg)", border: "1px solid var(--warn-border)", borderRadius: 8, padding: "10px 12px", maxHeight: 180, overflowY: "auto" }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--warn-fg)", marginBottom: 6 }}>À prévenir manuellement</div>
                  {envoiWa.echecs.map((e) => (
                    <div key={e.tracking} style={{ fontSize: 11.5, color: "var(--text)", marginBottom: 3 }}>
                      {e.tracking} — <span style={{ color: "var(--muted)" }}>{e.raison}</span>
                    </div>
                  ))}
                </div>
              )}
              {envoiWa.faits === envoiWa.total && (
                <button onClick={() => { setConfirmation(null); setEnvoiWa(null); }}
                  style={{ width: "100%", marginTop: 14, background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: 8, padding: "11px 0", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>
                  Fermer
                </button>
              )}
            </>
          ) : (
            <>
              <div style={{ fontSize: 13.5, color: "var(--text)", marginBottom: 8 }}>
                {(selectionAvance.length || colisInclus.length)} colis vont passer à <strong>« {confirmation.vuClient} »</strong>.
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 14 }}>
                Le changement est visible aussitôt par les clients concernés dans leur espace.
              </div>

              <button onClick={() => setPrevenir(!prevenir)}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, background: prevenir ? "var(--ok-bg)" : "var(--surface2)",
                         border: "1px solid " + (prevenir ? "var(--ok-border)" : "var(--border)"), borderRadius: 8, padding: "10px 12px",
                         cursor: "pointer", textAlign: "start", marginBottom: 12 }}>
                <span style={{ width: 18, height: 18, borderRadius: 6, flexShrink: 0, display: "grid", placeItems: "center",
                               background: prevenir ? "var(--ok-fg)" : "transparent", border: "1.5px solid " + (prevenir ? "var(--ok-fg)" : "var(--border)") }}>
                  {prevenir && <Check size={12} color="#fff" />}
                </span>
                <span style={{ fontSize: 12.5, color: "var(--text)" }}>Prévenir les clients par WhatsApp</span>
              </button>

              {prevenir && (
                <div style={{ background: "var(--surface2)", borderRadius: 8, padding: "10px 12px", marginBottom: 16 }}>
                  <div style={{ fontSize: 10.5, color: "var(--muted)", fontWeight: 700, marginBottom: 4 }}>APERÇU DU MESSAGE</div>
                  <div style={{ fontSize: 11.5, color: "var(--text)", lineHeight: 1.5 }}>
                    {colisInclus.length > 0 ? messagePourEtape(colisInclus[0], confirmation) : ""}
                  </div>
                </div>
              )}

              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => appliquerEtape(confirmation)}
                  style={{ flex: 1, background: "var(--brand-solid)", color: "#fff", border: "none", borderRadius: 8, padding: "11px 0", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>
                  Confirmer
                </button>
                <button onClick={() => setConfirmation(null)}
                  style={{ background: "none", border: "1px solid var(--border)", color: "var(--muted)", borderRadius: 8, padding: "11px 18px", fontSize: 13, cursor: "pointer" }}>
                  Annuler
                </button>
              </div>
            </>
          )}
        </Modal>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <span style={{ fontWeight: 700, color: "var(--text)", fontSize: 14 }}>Colis inclus ({colisInclus.length})</span>
        {colisLivres.length > 0 && (
          <button onClick={() => setVoirLivres((v) => !v)} style={{ background: "var(--ok-bg-soft)", border: "1px solid var(--ok-border)", color: "var(--ok-fg)", borderRadius: 20, padding: "4px 12px", fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}>
            {colisLivres.length} livré{colisLivres.length > 1 ? "s" : ""} · {voirLivres ? "masquer" : "afficher"}
          </button>
        )}
      </div>
      <div style={{ background: "var(--surface)", borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden", marginBottom: modification ? 18 : 0 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr style={{ background: "var(--surface2)", textAlign: "left" }}>{["ID Colis", "Destinataire", "Statut", "Poids", `Prix (${devise})`, modification ? "" : null].filter(Boolean).map((h) => <th key={h} style={{ padding: "10px 14px", fontSize: 10.5, color: "var(--muted)", fontWeight: 700 }}>{h}</th>)}</tr></thead>
          <tbody>
            {colisInclus.map((c) => {
              const st = STATUS_STYLE[c.status];
              return (
                <tr key={c.tracking} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "10px 14px", fontSize: 12.5, color: "var(--text)", fontWeight: 600 }}>{c.tracking}</td>
                  <td style={{ padding: "10px 14px", fontSize: 12.5, color: "var(--text)" }}>{c.destinataire}</td>
                  <td style={{ padding: "10px 14px" }}><span style={{ background: st.bg, color: st.fg, padding: "3px 9px", borderRadius: 20, fontSize: 10.5, fontWeight: 700 }}>{c.status}</span></td>
                  <td style={{ padding: "10px 14px", fontSize: 12.5, color: "var(--muted)" }}>{c.poids} kg</td>
                  <td style={{ padding: "10px 14px", fontSize: 12.5, color: "var(--text)" }}>{fmt(c.prix, devise)}</td>
                  {modification && <td style={{ padding: "10px 14px", textAlign: "right" }}><button onClick={() => retirer(c.tracking)} style={{ background: "none", border: "none", color: "var(--danger-fg)", cursor: "pointer" }}><X size={14} /></button></td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {modification && (
        <div>
          <div style={{ fontWeight: 700, color: "var(--text)", fontSize: 14, margin: "18px 0 10px" }}>Ajouter un colis non expédié à ce bordereau</div>
          <div style={{ background: "var(--surface)", borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden" }}>
            {ajoutables.length === 0 ? (
              <div style={{ padding: 16, color: "var(--muted)", fontSize: 13 }}>Aucun autre colis disponible sur cette route.</div>
            ) : ajoutables.map((c) => (
              <div key={c.tracking} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderTop: "1px solid var(--border)" }}>
                <div style={{ fontSize: 12.5, color: "var(--text)" }}>{c.tracking} — {c.destinataire} · {c.poids} kg</div>
                <button onClick={() => ajouter(c.tracking)} style={{ background: "#3ECB84", color: "#0A2647", border: "none", borderRadius: 6, padding: "5px 12px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>Ajouter</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {depenseForm && (
        <Modal onClose={() => setDepenseForm(null)} title="Ajouter une dépense liée à ce bordereau">
          <Field label="Libellé"><input value={depenseForm.nom} onChange={(e) => setDepenseForm({ ...depenseForm, nom: e.target.value })} style={inputStyle} placeholder="ex: Transport, douane..." /></Field>
          <Field label="Montant (GNF)"><input value={depenseForm.montant} onChange={(e) => setDepenseForm({ ...depenseForm, montant: e.target.value })} style={inputStyle} /></Field>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
            <button onClick={() => setDepenseForm(null)} style={{ padding: "9px 16px", borderRadius: 8, border: "1.5px solid var(--border)", background: "var(--surface2)", color: "var(--muted)", fontSize: 13, cursor: "pointer" }}>Annuler</button>
            <button onClick={ajouterDepense} style={{ padding: "9px 16px", borderRadius: 8, border: "none", background: "var(--brand-solid)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Enregistrer</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function TicketCard({ colis, onOpen, selectionMode, checked }) {
  const st = STATUS_STYLE[colis.status];
  const Icon = st.icon;
  return (
    <div onClick={onOpen} style={{ position: "relative", background: "var(--surface)", borderRadius: 16, overflow: "hidden", boxShadow: "0 3px 14px rgba(10,38,71,0.09)", cursor: "pointer", border: checked ? "2px solid var(--brand-solid)" : "1px solid var(--surface2)", transition: "box-shadow 0.15s, transform 0.15s" }}>
      {selectionMode && (
        <div style={{ position: "absolute", top: 12, right: 12, zIndex: 2, width: 24, height: 24, borderRadius: 7, background: checked ? "var(--brand-solid)" : "rgba(255,255,255,0.9)", border: "1.5px solid " + (checked ? "var(--brand-solid)" : "var(--border)"), display: "grid", placeItems: "center" }}>
          {checked && <Check size={15} color="#fff" />}
        </div>
      )}
      <div style={{ background: "#0A2647", padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: "#fff", fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 15.5, letterSpacing: 0.3 }}>{colis.tracking}</span>
        <span style={{ background: "rgba(255,255,255,0.15)", color: "#fff", fontSize: 11.5, fontWeight: 600, padding: "4px 10px", borderRadius: 20 }}>{colis.mode === "air" ? "AÉRIEN" : "MARITIME"}</span>
      </div>
      <div style={{ padding: "16px 18px" }}>
        <div style={{ fontSize: 15, color: "var(--text)", fontWeight: 700 }}>{colis.destinataire}</div>
        {colis.referenceCommande && (
          <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>réf. commande : <strong style={{ color: "var(--text)" }}>{colis.referenceCommande}</strong></div>
        )}
        {colis.emplacement && !colis.remise && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 6, marginInlineEnd: 6,
                        background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)",
                        borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>
            <MapPin size={10} /> {colis.emplacement}
          </div>
        )}
        {colis.litige && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 6,
                        background: colis.litige.statut === "Ouvert" ? "var(--warn-bg)" : "var(--ok-bg)",
                        border: "1px solid " + (colis.litige.statut === "Ouvert" ? "var(--warn-border)" : "var(--ok-border)"),
                        color: colis.litige.statut === "Ouvert" ? "var(--warn-fg)" : "var(--ok-fg)",
                        borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>
            {colis.litige.type === "perdu" ? "Perdu" : "Endommagé"}{colis.litige.statut === "Résolu" ? " · réglé" : ""}
          </div>
        )}
        <div style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 4, fontWeight: 500 }}>{routeLabel(colis.pays, colis.direction)}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12, background: st.bg, color: st.fg, padding: "6px 12px", borderRadius: 20, fontSize: 12.5, fontWeight: 700, width: "fit-content" }}><Icon size={14} /> {colis.status}</div>
      </div>
    </div>
  );
}

const WIZARD_STEPS = [
  { key: "route", label: "Route", icon: Globe },
  { key: "expediteur", label: "Expéditeur", icon: User },
  { key: "destinataire", label: "Destinataire", icon: MapPin },
  { key: "produits", label: "Produits", icon: Package },
  { key: "frais", label: "Frais", icon: DollarSign },
  { key: "resume", label: "Résumé", icon: CheckCircle2 },
];

function StepIndicator({ step }) {
  return (
    <div style={{ display: "flex", alignItems: "center", marginBottom: 22 }}>
      {WIZARD_STEPS.map((s, i) => (
        <React.Fragment key={s.key}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <div style={{
              width: 30, height: 30, borderRadius: "50%", display: "grid", placeItems: "center",
              background: i < step ? "#3D63FF" : i === step ? "var(--brand-solid)" : "var(--surface2)",
              border: i === step ? "2px solid var(--brand-solid)" : "none",
              color: i <= step ? "#fff" : "var(--muted)", fontSize: 12.5, fontWeight: 700,
            }}>{i < step ? <CheckCircle2 size={15} /> : <s.icon size={14} />}</div>
            <div style={{ fontSize: 10.5, color: i <= step ? "var(--text)" : "var(--muted)", fontWeight: 600, whiteSpace: "nowrap" }}>{s.label}</div>
          </div>
          {i < WIZARD_STEPS.length - 1 && <div style={{ flex: 1, height: 2, background: i < step ? "#3D63FF" : "var(--surface2)", margin: "0 6px 18px" }} />}
        </React.Fragment>
      ))}
    </div>
  );
}

/** Calcule la valeur (en GNF) d’une ligne produit : mode catalogue (catégorie) ou mode personnalisé (montant/devise/type saisis). */
/** Remise accordée selon le poids total du colis, en pourcentage. 0 si désactivée ou hors palier. */
function remiseVolumePourcent(poidsTotal, config) {
  if (!config || !config.active) return 0;
  const paliers = [...(config.paliers || [])].sort((a, b) => b.minKg - a.minKg);
  const atteint = paliers.find((p) => (Number(poidsTotal) || 0) >= Number(p.minKg));
  return atteint ? Number(atteint.remise) || 0 : 0;
}

function produitValeurGNF(p, categories) {
  const qty = Number(p.quantite) || 1;
  if (p.personnalise) {
    const montant = Number(p.montant) || 0;
    const devise = p.devise || "GNF";
    const montantGNF = devise === "GNF" ? montant : (montant / (LIVE_RATES[devise] || CURRENCIES[devise] || 1)) * (LIVE_RATES.GNF || CURRENCIES.GNF);
    return p.typePrix === "total" ? montantGNF : montantGNF * qty;
  }
  const cat = (categories || []).find((c) => c.nom === p.categorie);
  if (!cat) return 0;
  const rate = catPriceGNF(cat);
  return cat.type === "kg" ? rate * (Number(p.poids) || 0) : rate * qty;
}
function emptyProduit() { return { id: `p${Date.now()}${Math.random().toString(36).slice(2, 6)}`, nom: "", quantite: "1", poids: "", categorie: "", personnalise: false, montant: "", devise: "GNF", typePrix: "unitaire" }; }

function splitNom(full) {
  const parts = (full || "").trim().split(" ");
  if (parts.length <= 1) return { prenom: parts[0] || "", nom: "" };
  return { prenom: parts[0], nom: parts.slice(1).join(" ") };
}

function ColisForm({ onClose, onSave, existingColis, categories, session, sites, partenaires, clientAccounts, preAlertes, remiseVolumeConfig, repertoire, notify }) {
  const availableCountries = allowedCountries(session);
  const clientDirectory = useMemo(() => buildClientDirectory(existingColis || [], repertoire), [existingColis, repertoire]);
  const [step, setStep] = useState(0);
  const [expPrenom, setExpPrenom] = useState("");
  const [expNom, setExpNom] = useState("");
  const [expTelephone, setExpTelephone] = useState("");
  const [expEmail, setExpEmail] = useState("");
  const [expAdresse, setExpAdresse] = useState("");
  const [expPays, setExpPays] = useState("GN");
  const [expClientTrouve, setExpClientTrouve] = useState(null);
  const [destPrenom, setDestPrenom] = useState("");
  const [destNom, setDestNom] = useState("");
  const [destTelephone, setDestTelephone] = useState("");
  const [destEmail, setDestEmail] = useState("");
  const [destAdresse, setDestAdresse] = useState("");
  const [destVille, setDestVille] = useState("");
  const [destCodePostal, setDestCodePostal] = useState("");
  const [destPays, setDestPays] = useState(availableCountries.find((c) => c.code !== "GN")?.code || "FR");
  const [destClientTrouve, setDestClientTrouve] = useState(null);
  const [mode, setMode] = useState("air");
  const [produits, setProduits] = useState([emptyProduit()]);
  const [paye, setPaye] = useState("");
  // Devise dans laquelle l'agent saisit l'acompte. Le franc guinéen par défaut : c'est ce que le
  // client remet au comptoir. Le montant est converti pour être stocké dans la devise de référence.
  const [payeDevise, setPayeDevise] = useState("GNF");
  const [rabaisMontant, setRabaisMontant] = useState("0");
  const [rabaisDevise, setRabaisDevise] = useState("GNF");
  /*
   * Agence d'enregistrement : déduite du compte de l'agent, plus saisie à la main.
   *
   * Chaque utilisateur a déjà son site d'affectation (Configuration → Gestion Utilisateurs).
   * Demander à nouveau l'agence à chaque colis était une source d'erreur — un agent pressé
   * pouvait laisser la valeur par défaut et fausser les statistiques par site. Un administrateur
   * sans affectation garde le choix, puisqu'il peut enregistrer pour n'importe quelle agence.
   */
  const agenceImposee = session?.agence || "";
  const siteLocalParDefaut = sitesLocaux(sites)[0];
  const [agence, setAgence] = useState(agenceImposee || siteLocalParDefaut?.nom || "Bambeto");
  const [partenaireId, setPartenaireId] = useState("");
  const [clientAccountId, setClientAccountId] = useState("");
  const [preAlerteRapprochee, setPreAlerteRapprochee] = useState("");
  const [provenance, setProvenance] = useState("");
  /*
   * Recherche d'un client par son nom.
   *
   * Reconnaître un client à son numéro suppose que l'agent le connaisse — or au comptoir, le
   * client donne son nom bien plus souvent. Avec 343 fiches, retrouver « Fatoumata Diallo »
   * en tapant trois lettres évite de tout ressaisir à chaque envoi.
   */
  const [rechercheClient, setRechercheClient] = useState("");
  const [coteRecherche, setCoteRecherche] = useState(null);

  /*
   * Index de recherche, calculé UNE SEULE FOIS par annuaire.
   *
   * La version précédente normalisait les 343 noms à chaque touche frappée : le navigateur
   * signalait des blocages de près d'une demi-seconde, et la frappe devenait saccadée.
   * Ici la normalisation est faite d'avance ; taper une lettre ne fait plus qu'une comparaison
   * de chaînes déjà préparées.
   */
  const indexClients = useMemo(
    () => clientDirectory.map((c) => ({
      client: c,
      recherche: pourRecherche(`${c.nomComplet} ${c.telephone || ""}`),
    })),
    [clientDirectory]
  );

  const suggestionsClients = useMemo(() => {
    const q = pourRecherche(rechercheClient.trim());
    if (q.length < 2) return [];
    const trouves = [];
    // Boucle interrompue dès 6 résultats : inutile de parcourir tout l'annuaire.
    for (const entree of indexClients) {
      if (entree.recherche.includes(q)) {
        trouves.push(entree.client);
        if (trouves.length === 6) break;
      }
    }
    return trouves;
  }, [rechercheClient, indexClients]);

  /*
   * Champ de recherche par nom.
   *
   * Écrit comme une fonction qui retourne du JSX, et non comme un composant défini dans le corps
   * du formulaire : un composant recréé à chaque rendu est démonté puis remonté par React, ce qui
   * fait perdre le focus et la frappe dès la première lettre.
   */
  function champRecherche(cote) {
    const actif = coteRecherche === cote;
    return (
      <div style={{ position: "relative", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, padding: "0 12px" }}>
          <Search size={15} color="var(--muted)" />
          <input
            value={actif ? rechercheClient : ""}
            onChange={(e) => { setCoteRecherche(cote); setRechercheClient(e.target.value); }}
            onFocus={() => setCoteRecherche(cote)}
            placeholder="Rechercher un client déjà enregistré (nom ou téléphone)…"
            style={{ ...inputStyle, border: "none", background: "transparent", marginBottom: 0, flex: 1 }} />
          {actif && rechercheClient && (
            <button type="button" onClick={() => setRechercheClient("")}
              style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>×</button>
          )}
        </div>
        {actif && suggestionsClients.length > 0 && (
          <div style={{ position: "absolute", top: "100%", insetInlineStart: 0, insetInlineEnd: 0, zIndex: 20, marginTop: 4,
                        background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8,
                        boxShadow: "0 8px 22px rgba(0,0,0,0.22)", overflow: "hidden" }}>
            {suggestionsClients.map((c) => (
              <button key={c.telephone} type="button"
                onClick={() => { appliquerClient(c, cote); setRechercheClient(""); setCoteRecherche(null); }}
                style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10,
                         background: "none", border: "none", borderBottom: "1px solid var(--surface2)",
                         padding: "9px 12px", cursor: "pointer", textAlign: "start" }}>
                <span style={{ fontSize: 12.5, color: "var(--text)", fontWeight: 600 }}>{c.nomComplet}</span>
                <span style={{ fontSize: 11.5, color: "var(--muted)", flexShrink: 0 }}>
                  {c.telephone}{c.count > 0 ? ` · ${c.count} envoi${c.count > 1 ? "s" : ""}` : ""}
                </span>
              </button>
            ))}
          </div>
        )}
        {actif && rechercheClient.trim().length >= 2 && suggestionsClients.length === 0 && (
          <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 6 }}>
            Aucun client trouvé — remplissez les champs ci-dessous.
          </div>
        )}
      </div>
    );
  }

  function appliquerClient(match, cote) {
    const { prenom, nom } = splitNom(match.nomComplet);
    if (cote === "exp") {
      setExpPrenom(prenom); setExpNom(nom); setExpEmail(match.email || ""); setExpAdresse(match.adresse || "");
      setExpTelephone(match.telephone || "");
      if (match.pays && COUNTRIES.some((c) => c.code === match.pays)) setExpPays(match.pays);
      setExpClientTrouve(match);
    } else {
      setDestPrenom(prenom); setDestNom(nom); setDestEmail(match.email || ""); setDestAdresse(match.adresse || "");
      setDestTelephone(match.telephone || "");
      setDestVille(match.ville || ""); setDestCodePostal(match.codePostal || "");
      if (match.pays && COUNTRIES.some((c) => c.code === match.pays)) setDestPays(match.pays);
      setDestClientTrouve(match);
    }
  }

  function chercherClient(tel, cote) {
    const clean = (tel || "").replace(/\s/g, "");
    if (clean.length < 6) { cote === "exp" ? setExpClientTrouve(null) : setDestClientTrouve(null); return; }
    const cle = normaliserTelephone(clean);
    const match = clientDirectory.find((c) => normaliserTelephone(c.telephone) === cle);
    if (!match) { cote === "exp" ? setExpClientTrouve(null) : setDestClientTrouve(null); return; }
    const { prenom, nom } = splitNom(match.nomComplet);
    if (cote === "exp") {
      setExpPrenom(prenom); setExpNom(nom); setExpEmail(match.email); setExpAdresse(match.adresse);
      if (match.pays && COUNTRIES.some((c) => c.code === match.pays)) setExpPays(match.pays);
      setExpClientTrouve(match);
    } else {
      setDestPrenom(prenom); setDestNom(nom); setDestEmail(match.email); setDestAdresse(match.adresse);
      setDestVille(match.ville || ""); setDestCodePostal(match.codePostal || "");
      if (match.pays && COUNTRIES.some((c) => c.code === match.pays)) setDestPays(match.pays);
      setDestClientTrouve(match);
    }
  }
  const [photos, setPhotos] = useState([]);
  const [err, setErr] = useState("");

  // one side is expected to be Guinée (home base); the other determines the applicable rate table
  const direction = destPays === "GN" ? "import" : "export";
  const pays = destPays === "GN" ? expPays : destPays;
  const dest = COUNTRIES.find((c) => c.code === pays) || COUNTRIES.find((c) => c.code === "FR");
  const expCountry = COUNTRIES.find((c) => c.code === expPays);
  const destCountry = COUNTRIES.find((c) => c.code === destPays);
  const poidsTotal = produits.reduce((s, p) => s + (Number(p.poids) || 0), 0);
  const valeurDeclaree = produits.reduce((s, p) => s + produitValeurGNF(p, categories), 0);
  // Le montant facturé provient directement de la somme des valeurs produits
  // (tarif de catégorie × poids/quantité, ou prix personnalisé) — pas d’un tarif générique par pays.
  const prixBrut = +(valeurDeclaree / (LIVE_RATES.GNF || CURRENCIES.GNF)).toFixed(2);
  const telephone = destTelephone;
  const previousCount = telephone ? (existingColis || []).filter((c) => c.telephone === telephone.trim()).length : 0;
  const discountLoyalty = loyaltyDiscount(previousCount);
  // Les deux remises se cumulent : la fidélité récompense le nombre d'envois, la remise volume
  // récompense la taille du colis. Elles s'appliquent l'une après l'autre.
  const discountVolume = remiseVolumePourcent(poidsTotal, remiseVolumeConfig);
  const prixApresFidelite = +(prixBrut * (1 - discountLoyalty / 100) * (1 - discountVolume / 100)).toFixed(2);
  const rabaisEUR = +((Number(rabaisMontant) || 0) / (LIVE_RATES[rabaisDevise] || CURRENCIES[rabaisDevise] || 1)).toFixed(2);
  const prix = Math.max(+(prixApresFidelite - rabaisEUR).toFixed(2), 0);
  const payeNum = (Number(paye) || 0) / (LIVE_RATES[payeDevise] || CURRENCIES[payeDevise] || 1);
  const reste = Math.max(prix - payeNum, 0);
  const destCurrency = dest?.currency || "EUR";

  // Le poids et la quantité ne peuvent pas être négatifs : sans ce contrôle, un colis à -5 kg
  // pouvait être enregistré et faussait ensuite les totaux de poids et les commissions.
  // L'attribut min= du champ ne protège pas contre un collage ou une saisie programmée.
  /*
   * Suggestion automatique de la catégorie d'après le nom du produit.
   *
   * Chaque catégorie porte des mots-clés (« adidas » et « nike » pour Chaussure marque, la liste
   * des marques pour Vêtements de marque…). Ils servaient uniquement à la recherche : l'agent
   * devait quand même choisir dans une liste de 30 entrées à chaque ligne de produit.
   *
   * On ne remplace jamais un choix déjà fait — l'agent garde la main.
   */
  function deviner(nomProduit) {
    const texte = pourRecherche(nomProduit);
    if (texte.length < 3) return null;
    const trouvee = (categories || []).find((cat) =>
      (cat.motsCles || []).some((mot) => {
        const m = pourRecherche(mot);
        return m.length >= 3 && texte.includes(m);
      })
    );
    return trouvee ? trouvee.nom : null;
  }

  function updateProduit(id, patch) {
    const propre = { ...patch };
    if ("poids" in propre && propre.poids !== "" && Number(propre.poids) < 0) propre.poids = "0";
    if ("quantite" in propre && propre.quantite !== "" && Number(propre.quantite) < 1) propre.quantite = "1";
    setProduits((list) => list.map((p) => {
      if (p.id !== id) return p;
      const maj = { ...p, ...propre };
      // La catégorie n'est suggérée que si l'agent n'en a pas encore choisi une.
      if ("nom" in propre && !p.categorie) {
        const suggeree = deviner(propre.nom);
        if (suggeree) maj.categorie = suggeree;
      }
      return maj;
    }));
  }
  function addProduit() { setProduits((list) => [...list, emptyProduit()]); }
  function removeProduit(id) { setProduits((list) => (list.length > 1 ? list.filter((p) => p.id !== id) : list)); }

  /*
   * Ajout de photos, plafonné à 4 par colis.
   *
   * Chaque photo est conservée en base64 dans les données, et l'application réécrit l'ensemble
   * à chaque modification. Sans plafond, un agent zélé qui photographie sous six angles alourdit
   * durablement TOUTES les opérations de l'agence, pas seulement ce colis.
   * Quatre vues suffisent à constater l'état d'un colis à l'arrivée.
   */
  const MAX_PHOTOS = 4;

  function addPhotos(e) {
    const files = Array.from(e.target.files || []);
    const placeRestante = MAX_PHOTOS - photos.length;
    if (placeRestante <= 0) {
      notify?.(`${MAX_PHOTOS} photos au maximum par colis`);
      e.target.value = "";
      return;
    }
    if (files.length > placeRestante) {
      notify?.(`Seules les ${placeRestante} premières photos seront ajoutées (${MAX_PHOTOS} au maximum)`);
    }
    files.slice(0, placeRestante).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const c = document.createElement("canvas");
          const scale = Math.min(1, 500 / img.width);
          c.width = img.width * scale; c.height = img.height * scale;
          c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
          setPhotos((p) => [...p, c.toDataURL("image/jpeg", 0.6)]);
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  }
  function removePhoto(i) { setPhotos((p) => p.filter((_, idx) => idx !== i)); }

  function checkPhoneOrErr(tel, label) {
    const match = DIAL_CODES.filter((c) => tel?.startsWith("+" + c.dial)).sort((a, b) => b.dial.length - a.dial.length)[0];
    const dial = match ? match.dial : "224";
    const rest = match ? tel.slice(dial.length + 1) : (tel || "").replace(/^\+/, "");
    if (isPhoneValid(dial, rest) === false) { setErr(`Le numéro de téléphone ${label} semble incorrect — vérifiez le nombre de chiffres.`); return false; }
    return true;
  }
  function next() {
    setErr("");
    if (step === 0 && expPays === destPays) { setErr("Le pays expéditeur et le pays destinataire doivent être différents."); return; }
    if (step === 1 && (!expPrenom || !expNom || !expTelephone)) { setErr("Merci de renseigner le prénom, le nom et le téléphone de l’expéditeur."); return; }
    if (step === 1 && !checkPhoneOrErr(expTelephone, "de l’expéditeur")) return;
    if (step === 2 && (!destPrenom || !destNom || !destTelephone)) { setErr("Merci de renseigner le prénom, le nom et le téléphone du destinataire."); return; }
    if (step === 2 && !checkPhoneOrErr(destTelephone, "du destinataire")) return;
    if (step === 3 && produits.some((p) => !p.nom)) { setErr("Merci de renseigner le nom de chaque produit."); return; }
    // Le poids doit être strictement positif : un colis de 0 kg n'existe pas. Le test précédent
    // (!p.poids) laissait passer la valeur "0", car une chaîne "0" est considérée comme remplie.
    if (step === 3 && produits.some((p) => !(Number(p.poids) > 0))) { setErr("Le poids de chaque produit doit être supérieur à 0 kg."); return; }
    if (step === 3 && produits.some((p) => !(Number(p.quantite) >= 1))) { setErr("La quantité de chaque produit doit être d'au moins 1."); return; }
    setStep((s) => Math.min(s + 1, WIZARD_STEPS.length - 1));
  }
  function prev() { setErr(""); setStep((s) => Math.max(s - 1, 0)); }

  function submit(e) {
    e.preventDefault();
    if (!expNom || !destNom || !destTelephone) return;
    if (!(poidsTotal > 0)) { setErr("Le poids total du colis doit être supérieur à 0 kg."); return; }
    onSave({
      tracking: genTracking((existingColis || []).map((c) => c.tracking)),
      expediteur: `${expPrenom} ${expNom}`.trim(), expediteurTelephone: expTelephone, expediteurEmail: expEmail, expediteurAdresse: expAdresse, expediteurPays: expPays,
      destinataire: `${destPrenom} ${destNom}`.trim(), telephone: destTelephone, destinataireEmail: destEmail, destinataireAdresse: destAdresse, destinataireVille: destVille, destinataireCodePostal: destCodePostal, destinatairePays: destPays,
      pays, direction, mode, produits, poids: +poidsTotal.toFixed(2), volume: 0, valeurDeclaree, site: agence, partenaireId: partenaireId || null, clientAccountId: clientAccountId || null, provenance: provenance || null, preAlerteRapprochee: preAlerteRapprochee || null,
      agentCreation: session ? `${session.prenom} ${session.nom}`.trim() || session.identifiant : "",
      prixBrut, discountLoyalty, rabaisMontant: Number(rabaisMontant) || 0, rabaisDevise, rabaisEUR, prix, paye: payeNum, reste, photos,
      paiements: payeNum > 0 ? [{ id: `pay${Date.now()}`, montant: payeNum, mode: "Espèces", date: new Date().toISOString(), par: "Enregistrement initial" }] : [],
      notesInternes: "",
      status: "Enregistré", historique: [{ status: "Enregistré", date: new Date().toISOString() }],
      createdAt: new Date().toISOString(), pod: null, signature: null, driverLoc: null,
    });
  }

  return (
    <Modal onClose={onClose} title="Nouveau Colis" wide saisieEnCours={!!expPrenom || !!expNom || !!destPrenom || !!destNom || produits.some((p) => p.nom)}>
      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 14 }}>📍 Envoi de {expCountry?.name.toUpperCase()} {FLAGS[expPays]} vers {destCountry?.name.toUpperCase()} {FLAGS[destPays]}</div>
      <StepIndicator step={step} />
      <div>
        {step === 0 && (
          <div>
            <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 16 }}>Choisissez le pays d’expédition et le pays de destination — les tarifs et la devise seront calculés automatiquement.</div>
            {availableCountries.length < COUNTRIES.length && (
              <div style={{ fontSize: 11.5, color: "var(--warn-fg)", marginBottom: 12 }}>Votre compte est limité à certaines destinations par votre administrateur.</div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 10, alignItems: "end" }}>
              <Field label="Pays expéditeur *">
                <select value={expPays} onChange={(e) => setExpPays(e.target.value)} style={inputStyle}>
                  {availableCountries.map((c) => <option key={c.code} value={c.code}>{FLAGS[c.code]} {c.name} ({c.city})</option>)}
                </select>
              </Field>
              <div style={{ paddingBottom: 10 }}><ChevronRight size={18} color="var(--muted)" /></div>
              <Field label="Pays destinataire *">
                <select value={destPays} onChange={(e) => setDestPays(e.target.value)} style={inputStyle}>
                  {availableCountries.map((c) => <option key={c.code} value={c.code}>{FLAGS[c.code]} {c.name} ({c.city})</option>)}
                </select>
              </Field>
            </div>
            <div style={{ marginTop: 16, background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "center", gap: 12, fontSize: 15, fontWeight: 700, color: "var(--text)" }}>
              {FLAGS[expPays]} {expCountry?.city} <ChevronRight size={16} color="var(--danger-fg)" /> {FLAGS[destPays]} {destCountry?.city}
            </div>
          </div>
        )}
        {step === 1 && (
          <div>
            <div style={{ background: "var(--surface2)", borderRadius: 12, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 20 }}>{FLAGS[expPays]}</span>
              <div><div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>Expéditeur • {expCountry?.name.toUpperCase()}</div><div style={{ fontSize: 11.5, color: "var(--muted)" }}>Personne qui envoie le colis</div></div>
            </div>
            {champRecherche("exp")}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <Field label="Téléphone * — le client est reconnu automatiquement s’il a déjà expédié">
                  <PhoneInput value={expTelephone} onChange={setExpTelephone} onBlur={(full) => chercherClient(full, "exp")} />
                </Field>
                {expClientTrouve && <div style={{ fontSize: 11.5, color: "var(--ok-fg)", marginTop: -8, marginBottom: 12 }}>✓ Client reconnu — informations reprises de son dernier colis du {new Date(expClientTrouve.date).toLocaleDateString("fr-FR")}</div>}
              </div>
              <Field label="Prénom *"><input value={expPrenom} onChange={(e) => setExpPrenom(e.target.value)} style={inputStyle} placeholder="Prénom de l’expéditeur" autoFocus /></Field>
              <Field label="Nom *"><input value={expNom} onChange={(e) => setExpNom(e.target.value)} style={inputStyle} placeholder="Nom de l’expéditeur" /></Field>
              <Field label="Email (optionnel)"><input value={expEmail} onChange={(e) => setExpEmail(e.target.value)} style={inputStyle} placeholder="email@exemple.com" /></Field>
              <div style={{ gridColumn: "1 / -1" }}>
                <Field label="Adresse"><input value={expAdresse} onChange={(e) => setExpAdresse(e.target.value)} style={inputStyle} placeholder="Adresse complète de l’expéditeur" /></Field>
              </div>
            </div>
          </div>
        )}
        {step === 2 && (
          <div>
            <div style={{ background: "var(--ok-bg-soft)", borderRadius: 12, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 20 }}>{FLAGS[destPays]}</span>
              <div><div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>Destinataire • {destCountry?.name.toUpperCase()}</div><div style={{ fontSize: 11.5, color: "var(--muted)" }}>Personne qui recevra le colis</div></div>
            </div>
            {champRecherche("dest")}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <Field label="Téléphone * — le client est reconnu automatiquement s’il a déjà reçu un colis">
                  <PhoneInput value={destTelephone} onChange={setDestTelephone} onBlur={(full) => chercherClient(full, "dest")} defaultDial={DIAL_CODES.find((c) => c.name === destCountry?.name)?.dial} />
                </Field>
                {destClientTrouve && <div style={{ fontSize: 11.5, color: "var(--ok-fg)", marginTop: -8, marginBottom: 12 }}>✓ Client reconnu — informations reprises de son dernier colis du {new Date(destClientTrouve.date).toLocaleDateString("fr-FR")}</div>}
              </div>
              <Field label="Prénom *"><input value={destPrenom} onChange={(e) => setDestPrenom(e.target.value)} style={inputStyle} placeholder="Prénom du destinataire" autoFocus /></Field>
              <Field label="Nom *"><input value={destNom} onChange={(e) => setDestNom(e.target.value)} style={inputStyle} placeholder="Nom du destinataire" /></Field>
              <Field label="Email (optionnel)"><input value={destEmail} onChange={(e) => setDestEmail(e.target.value)} style={inputStyle} placeholder="email@exemple.com" /></Field>
              <div style={{ gridColumn: "1 / -1" }}>
                <Field label="Adresse *"><input value={destAdresse} onChange={(e) => setDestAdresse(e.target.value)} style={inputStyle} placeholder="Adresse complète (rue, quartier, repère...)" /></Field>
              </div>
              <Field label="Ville"><input value={destVille} onChange={(e) => setDestVille(e.target.value)} style={inputStyle} placeholder="Paris" /></Field>
              <Field label="Code postal"><input value={destCodePostal} onChange={(e) => setDestCodePostal(e.target.value)} style={inputStyle} placeholder="75001" /></Field>
            </div>
          </div>
        )}
        {step === 3 && (
          <div>
            <div style={{ background: "var(--warn-bg)", borderRadius: 12, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
              <Package size={18} color="var(--warn-fg)" />
              <div><div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>Contenu du colis</div><div style={{ fontSize: 11.5, color: "var(--muted)" }}>Détaillez chaque produit dans le colis</div></div>
            </div>
            {produits.map((p, idx) => (
              <div key={p.id} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 16, marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{idx + 1}. Produit</div>
                  {produits.length > 1 && <button type="button" onClick={() => removeProduit(p.id)} style={{ background: "none", border: "none", color: "var(--danger-fg)", cursor: "pointer" }}><Trash2 size={14} /></button>}
                </div>
                <Field label="Nom du produit *"><input value={p.nom} onChange={(e) => updateProduit(p.id, { nom: e.target.value })} style={inputStyle} placeholder="Rechercher ou saisir un produit..." /></Field>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
                  <Field label="Quantité *"><input type="number" min="1" step="1" inputMode="numeric" value={p.quantite} onChange={(e) => updateProduit(p.id, { quantite: e.target.value })} style={inputStyle} /></Field>
                  <Field label="Poids du colis (kg) *"><input type="number" min="0" step="0.1" inputMode="decimal" value={p.poids} onChange={(e) => updateProduit(p.id, { poids: e.target.value })} style={inputStyle} /></Field>
                </div>
                <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: -8, marginBottom: 12 }}>Le poids est indépendant de la quantité — il représente le poids réel du colis, jamais multiplié.</div>

                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: 12 }}>
                  <input type="checkbox" checked={p.personnalise} onChange={(e) => {
                    const patch = { personnalise: e.target.checked };
                    if (e.target.checked) { patch.prixModifiePar = `${session?.prenom || ""} ${session?.nom || ""}`.trim(); patch.prixModifieLe = new Date().toISOString(); }
                    updateProduit(p.id, patch);
                  }} />
                  <span style={{ fontSize: 12.5, color: "var(--text)", fontWeight: 600 }}>Utiliser un prix personnalisé</span>
                </label>

                {p.personnalise ? (
                  <div>
                    <div style={{ background: "var(--warn-bg)", color: "var(--warn-fg)", borderRadius: 8, padding: "8px 12px", fontSize: 11.5, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                      <AlertTriangle size={13} /> Prix personnalisé actif — le tarif de catégorie n’est pas utilisé pour ce produit.
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, marginBottom: 10 }}>
                      <Field label="Montant *"><input value={p.montant} onChange={(e) => updateProduit(p.id, { montant: e.target.value, prixModifiePar: `${session?.prenom || ""} ${session?.nom || ""}`.trim(), prixModifieLe: new Date().toISOString() })} style={inputStyle} /></Field>
                      <Field label="Devise"><select value={p.devise} onChange={(e) => updateProduit(p.id, { devise: e.target.value })} style={inputStyle}>{["GNF", "EUR", "USD"].map((d) => <option key={d} value={d}>{d}</option>)}</select></Field>
                    </div>
                    <Field label="Type de prix">
                      <div style={{ display: "flex", gap: 8 }}>
                        <button type="button" onClick={() => updateProduit(p.id, { typePrix: "unitaire" })} style={{ ...toggleBtn, ...(p.typePrix === "unitaire" ? toggleActive : {}) }}>Unitaire (× quantité)</button>
                        <button type="button" onClick={() => updateProduit(p.id, { typePrix: "total" })} style={{ ...toggleBtn, ...(p.typePrix === "total" ? toggleActive : {}) }}>Total (fixe)</button>
                      </div>
                    </Field>
                    {p.prixModifiePar && <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 6 }}>Modifié par {p.prixModifiePar} le {new Date(p.prixModifieLe).toLocaleString("fr-FR")}</div>}
                  </div>
                ) : (
                  <Field label="Catégorie">
                    <select value={p.categorie} onChange={(e) => updateProduit(p.id, { categorie: e.target.value })} style={inputStyle}>
                      <option value="">-- Sélectionner une catégorie --</option>
                      {(categories || []).filter((c) => c.visibiliteColis !== false && (!c.paysLimite || c.paysLimite === pays)).map((c) => <option key={c.id} value={c.nom}>{c.emoji} {c.nom} ({fmtGNF(catPriceGNF(c))}{c.type === "kg" ? "/kg" : "/unité"})</option>)}
                    </select>
                  </Field>
                )}

                {(() => {
                  const val = produitValeurGNF(p, categories);
                  if (!val) return null;
                  return (
                    <div style={{ fontSize: 11.5, color: "var(--ok-fg)", marginTop: 8 }}>
                      Valeur {p.personnalise ? "saisie" : "suggérée"} : {fmtGNF(val)} ≈ {fmt(val / (LIVE_RATES.GNF || 9500), destCurrency)}
                    </div>
                  );
                })()}
              </div>
            ))}
            <button type="button" onClick={addProduit} style={{ width: "100%", border: "1.5px dashed var(--border)", borderRadius: 12, padding: "12px 0", background: "none", color: "var(--muted)", fontSize: 13, cursor: "pointer", marginBottom: 14 }}>+ Ajouter un produit</button>
            <div style={{ background: "var(--surface2)", borderRadius: 12, padding: "12px 16px", display: "flex", justifyContent: "space-between" }}>
              <div style={{ fontSize: 13, color: "var(--text)" }}>Poids total : <strong>{poidsTotal.toFixed(1)} kg</strong></div>
              <div style={{ fontSize: 13, color: "var(--text)" }}>Valeur déclarée : <strong>{fmtGNF(valeurDeclaree)}</strong></div>
            </div>
          </div>
        )}
        {step === 4 && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 14 }}>
              <Field label="Route (déterminée par expéditeur/destinataire)">
                <div style={{ ...inputStyle, display: "flex", alignItems: "center", background: "var(--surface2)", color: "var(--text)", fontWeight: 600 }}>
                  {FLAGS[expPays]} {expCountry?.city} <ChevronRight size={13} style={{ margin: "0 4px" }} /> {FLAGS[destPays]} {destCountry?.city}
                </div>
              </Field>
              <Field label="Mode de transport">
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" onClick={() => setMode("air")} style={{ ...toggleBtn, ...(mode === "air" ? toggleActive : {}) }}><Plane size={14} /> Aérien</button>
                  <button type="button" disabled title="Voie maritime temporairement indisponible" style={{ ...toggleBtn, opacity: 0.4, cursor: "not-allowed" }}><Ship size={14} /> Maritime</button>
                </div>
              </Field>
              <Field label="Montant du rabais"><input value={rabaisMontant} onChange={(e) => setRabaisMontant(e.target.value)} style={inputStyle} placeholder="0" /></Field>
              <Field label="Devise du rabais">
                <select value={rabaisDevise} onChange={(e) => setRabaisDevise(e.target.value)} style={inputStyle}>
                  {[...new Set(["GNF", "EUR", expCountry?.currency, destCountry?.currency].filter(Boolean))].map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              {!agenceImposee && <Field label="Agence d’enregistrement">
                <select value={agence} onChange={(e) => setAgence(e.target.value)} style={inputStyle}>
                  {(() => {
                    const locaux = sitesLocaux(sites);
                    return (locaux.length > 0 ? locaux : [{ id: "x", nom: "Bambeto" }]).map((s) => <option key={s.id} value={s.nom}>{s.nom}</option>);
                  })()}
                </select>
              </Field>}
      {/*
        Le rattachement à un compte client a été retiré de cet écran : il encombrait la création
        d'un colis, geste le plus fréquent des agents. Le rattachement se fait là où il a du sens —
        Centre clients → Pré-alertes → « Réceptionner & peser » — où le colis part justement d'une
        commande annoncée par un client identifié.
      */}
              <Field label="Montant payé à l’enregistrement">
                <div style={{ display: "flex", gap: 8 }}>
                  <input type="number" step="0.01" min="0" value={paye} onChange={(e) => setPaye(e.target.value)} style={{ ...inputStyle, flex: 1, marginBottom: 0 }} placeholder="0" />
                  <select value={payeDevise} onChange={(e) => setPayeDevise(e.target.value)} style={{ ...inputStyle, width: 100, marginBottom: 0 }}>
                    {Object.keys(CURRENCIES).map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </Field>
            </div>
            {discountLoyalty > 0 && <div style={{ fontSize: 12, color: "var(--ok-fg)", marginBottom: 10 }}>Remise fidélité automatique : -{discountLoyalty}% ({previousCount} envois précédents)</div>}
            {discountVolume > 0 && <div style={{ fontSize: 12, color: "var(--ok-fg)", marginBottom: 10 }}>Remise volume : -{discountVolume}% ({poidsTotal.toFixed(1)} kg)</div>}
            <div style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 10 }}>FRAIS D’EXPÉDITION</div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--text)", marginBottom: 6 }}><span>Valeur des produits ({poidsTotal.toFixed(1)} kg · {mode === "air" ? "Aérien" : "Maritime"})</span><span>{fmt(prixBrut, "GNF")}</span></div>
              {discountLoyalty > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--ok-fg)", marginBottom: 6 }}><span>Remise fidélité (-{discountLoyalty}%)</span><span>-{fmt(prixBrut - prixApresFidelite, "GNF")}</span></div>}
              {discountVolume > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--ok-fg)", marginBottom: 6 }}><span>Remise volume (-{discountVolume}%)</span><span>-{fmt(prixBrut * (1 - discountLoyalty / 100) * discountVolume / 100, destCurrency)}</span></div>}
              {rabaisEUR > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--ok-fg)", marginBottom: 6 }}><span>Rabais ({fmt(rabaisEUR, rabaisDevise)})</span><span>-{fmt(rabaisEUR, "GNF")}</span></div>}
              <div style={{ borderTop: "1px solid var(--border)", margin: "8px 0" }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 700, color: "var(--text)" }}><span>Total à payer</span><span>{fmt(prix, "GNF")}</span></div>
              <div style={{ fontSize: 11.5, color: "var(--muted)", textAlign: "right" }}>≈ {fmt(prix, destCurrency)}</div>
            </div>
          </div>
        )}
        {step === 5 && (
          <div style={{ border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
            <div style={{ background: "linear-gradient(135deg, #0A2647, #131A6B)", padding: "20px 22px", color: "#fff" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <CheckCircle2 size={18} color="var(--ok-fg)" />
                <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 16, fontWeight: 700 }}>Récapitulatif du colis</div>
              </div>
              <div style={{ fontSize: 12, color: "var(--neutral-fg)", marginBottom: 12 }}>Vérifiez toutes les informations avant validation</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, fontWeight: 700 }}>
                {FLAGS[expPays]} {expCountry?.name.toUpperCase()} <ChevronRight size={15} color="var(--neutral-fg)" /> {FLAGS[destPays]} {destCountry?.name.toUpperCase()}
                <span style={{ marginInlineStart: "auto", fontSize: 11, fontWeight: 600, background: "rgba(255,255,255,0.15)", padding: "3px 10px", borderRadius: 20 }}>{mode === "air" ? "Aérien" : "Maritime"}</span>
              </div>
            </div>

            <div style={{ padding: 20 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: 18 }}>
                <div style={{ background: "var(--surface2)", borderRadius: 12, padding: 16, borderInlineStart: "3px solid #5B8DEF" }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--info-fg)", letterSpacing: 0.4, marginBottom: 6 }}>EXPÉDITEUR · {expCountry?.name.toUpperCase()}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{expPrenom} {expNom}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{expTelephone || "—"}</div>
                  {expEmail && <div style={{ fontSize: 12, color: "var(--muted)" }}>{expEmail}</div>}
                  <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 4 }}>{expAdresse || "Adresse non renseignée"}</div>
                </div>
                <div style={{ background: "var(--surface2)", borderRadius: 12, padding: 16, borderInlineStart: "3px solid #3ECB84" }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--ok-fg)", letterSpacing: 0.4, marginBottom: 6 }}>DESTINATAIRE · {destCountry?.name.toUpperCase()}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{destPrenom} {destNom}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{destTelephone || "—"}</div>
                  {destEmail && <div style={{ fontSize: 12, color: "var(--muted)" }}>{destEmail}</div>}
                  <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 4 }}>
                    {destAdresse || "Adresse non renseignée"}{destVille ? `, ${destVille}` : ""}{destCodePostal ? ` ${destCodePostal}` : ""}
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: 18 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 700, color: "var(--muted)", letterSpacing: 0.4, marginBottom: 10 }}><Package size={13} /> PRODUITS ({produits.length}) · {poidsTotal.toFixed(1)} kg au total</div>
                <div style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
                  {produits.map((p, i) => (
                    <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderTop: i > 0 ? "1px solid var(--border)" : "none" }}>
                      <div>
                        <div style={{ fontSize: 13, color: "var(--text)", fontWeight: 600 }}>×{p.quantite || 1} {p.nom || "Produit sans nom"}</div>
                        <div style={{ fontSize: 11, color: "var(--muted)" }}>{p.personnalise ? `Prix personnalisé (${p.typePrix === "total" ? "total" : "unitaire"})` : (p.categorie || "Sans catégorie")}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 13, color: "var(--text)", fontWeight: 600 }}>{fmtGNF(produitValeurGNF(p, categories))}</div>
                        <div style={{ fontSize: 11, color: "var(--muted)" }}>{(Number(p.poids) || 0).toFixed(1)} kg</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 12, padding: 16, marginBottom: 18 }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--muted)", letterSpacing: 0.4, marginBottom: 10 }}>FRAIS D’EXPÉDITION</div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "var(--text)", marginBottom: 5 }}><span>Sous-total produits</span><span>{fmt(prixBrut, "GNF")}</span></div>
                {discountLoyalty > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "var(--ok-fg)", marginBottom: 5 }}><span>Remise fidélité</span><span>-{discountLoyalty}%</span></div>}
                {rabaisEUR > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "var(--ok-fg)", marginBottom: 5 }}><span>Rabais appliqué</span><span>-{fmt(rabaisEUR, rabaisDevise)}</span></div>}
                <div style={{ borderTop: "1px solid var(--border)", margin: "8px 0" }} />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 17, fontWeight: 700, color: "var(--text)" }}><span>Total à payer</span><span>{fmt(prix, "GNF")}</span></div>
                <div style={{ fontSize: 11.5, color: "var(--muted)", textAlign: "right", marginBottom: 8 }}>≈ {fmt(prix, destCurrency)}</div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
                  <span style={{ color: "var(--muted)" }}>Payé à l’enregistrement</span><span style={{ color: "var(--text)", fontWeight: 600 }}>{fmt(payeNum, "EUR")}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
                  <span style={{ color: "var(--muted)" }}>Reste à payer</span><span style={{ color: reste > 0 ? "var(--danger-fg)" : "var(--ok-fg)", fontWeight: 700 }}>{fmt(reste, "EUR")}</span>
                </div>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: photos.length ? 14 : 0, fontSize: 11.5, color: "var(--muted)" }}>
                <span>Mode : <strong style={{ color: "var(--text)" }}>{mode === "air" ? "Aérien" : "Maritime"}</strong></span>
                <span>·</span>
                <span>Agence : <strong style={{ color: "var(--text)" }}>{agence}</strong></span>
                {partenaireId && partenaires && (<><span>·</span><span>Partenaire : <strong style={{ color: "var(--text)" }}>{partenaires.find((p) => p.id === partenaireId)?.prenom} {partenaires.find((p) => p.id === partenaireId)?.nom}</strong></span></>)}
              </div>

              <div>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--muted)", letterSpacing: 0.4, marginBottom: 8 }}>PHOTOS (optionnel)</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(80px,1fr))", gap: 10 }}>
                  {photos.map((src, i) => (
                    <div key={i} style={{ position: "relative" }}>
                      <img src={src} alt={`Photo ${i + 1}`} style={{ width: "100%", height: 80, objectFit: "cover", borderRadius: 8, border: "1.5px solid var(--border)" }} />
                      <button type="button" onClick={() => removePhoto(i)} style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%", background: "var(--brand-solid)", color: "#fff", border: "2px solid var(--surface)", cursor: "pointer", display: "grid", placeItems: "center" }}><X size={11} /></button>
                    </div>
                  ))}
                  <label style={{ height: 80, borderRadius: 8, border: "1.5px dashed var(--border)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, color: "var(--muted)", fontSize: 10.5, cursor: "pointer" }}>
                    <Camera size={16} /> Ajouter
                    <input type="file" accept="image/*" multiple onChange={addPhotos} style={{ display: "none" }} />
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {err && <div style={{ color: "var(--danger-fg)", fontSize: 12.5, marginTop: 12 }}>{err}</div>}

        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 22 }}>
          <button type="button" onClick={step === 0 ? onClose : prev} style={{ padding: "10px 18px", borderRadius: 8, border: "1.5px solid var(--border)", background: "var(--surface)", color: "var(--muted)", fontSize: 13.5, cursor: "pointer" }}>
            {step === 0 ? "Annuler" : "Précédent"}
          </button>
          {step < WIZARD_STEPS.length - 1 ? (
            <button type="button" onClick={next} style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 20px", borderRadius: 8, border: "none", background: "#3D63FF", color: "#fff", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>
              Suivant <ChevronRight size={15} />
            </button>
          ) : (
            <button type="button" onClick={submit} style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: "var(--brand-solid)", color: "#fff", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>
              Créer le colis
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

/**
 * Bordereau de réception client — généré après qu’un agent a sélectionné les colis disponibles
 * (arrivés, prêts à être récupérés) d’un client. Calcule les frais de récupération selon le
 * poids total du lot, avec le tarif dégressif au kg configuré (moins cher au-delà du seuil).
 */
/** Bordereau personnel PDF pour un client — récapitulatif de tous ses colis, à télécharger depuis son espace. */
async function downloadClientManifest(compte, colisListe, devise = "GNF") {
  const jspdf = await loadJsPDF();
  const doc = preparerDocPdf(new jspdf.jsPDF());
  const W = 210, H = 297, M = 14;
  const NAVY = [10, 38, 71], INK = [26, 30, 38], MUTED = [122, 130, 142], LINE = [225, 228, 234], TINT = [240, 245, 252];

  /*
   * Tableau dessiné directement, sans le module autoTable.
   *
   * Ce module était chargé depuis Internet : quand le chargement échouait — cas fréquent pour un
   * client à l'étranger avec une connexion instable — le bordereau sortait avec l'en-tête et les
   * totaux mais AUCUN colis, sans le moindre message. Et le pied de page, figé à 288 mm, venait
   * se superposer au tableau dès que la liste était longue.
   *
   * Tout est désormais tracé ici : pagination gérée, pied de page sur chaque page, aucun risque
   * de document vide.
   */
  const COLONNES = [
    { titre: "N° de suivi", largeur: 30, cle: (c) => c.tracking },
    { titre: "Votre référence", largeur: 34, cle: (c) => c.referenceCommande || "—" },
    { titre: "Trajet", largeur: 42, cle: (c) => routeLabel(c.pays, c.direction) },
    { titre: "Où en est-il", largeur: 40, cle: (c) => clientStatusLabel(c.status) },
    { titre: "Poids", largeur: 18, cle: (c) => `${c.poids} kg`, droite: true },
    { titre: "À régler", largeur: 18, cle: (c) => (c.reste > 0 ? fmt(c.reste, devise) : "Payé"), droite: true },
  ];
  const largeurTotale = COLONNES.reduce((s, c) => s + c.largeur, 0);

  const piedDePage = (numPage, total) => {
    doc.setDrawColor(...LINE); doc.setLineWidth(0.3); doc.line(M, H - 16, W - M, H - 16);
    doc.setFontSize(7.3); doc.setTextColor(...MUTED); doc.setFont(undefined, "normal");
    doc.text("Ba-Diaby Express — Transport de colis Conakry - Monde · badiabyexpress.bde@gmail.com", M, H - 11);
    doc.text(`Page ${numPage} / ${total}`, W - M, H - 11, { align: "right" });
  };

  const enTeteTableau = (y) => {
    doc.setFillColor(...NAVY); doc.rect(M, y, largeurTotale, 8, "F");
    doc.setFontSize(8); doc.setFont(undefined, "bold"); doc.setTextColor(255, 255, 255);
    let x = M;
    COLONNES.forEach((col) => {
      doc.text(col.titre, col.droite ? x + col.largeur - 2 : x + 2, y + 5.4, col.droite ? { align: "right" } : undefined);
      x += col.largeur;
    });
    return y + 8;
  };

  // ── En-tête ───────────────────────────────────────────────────────────────
  doc.setFillColor(...NAVY); doc.rect(0, 0, W, 34, "F");
  doc.addImage(DEFAULT_LOGO, "PNG", M, 7, 20, 20);
  doc.setTextColor(255, 255, 255); doc.setFont(undefined, "bold"); doc.setFontSize(15);
  doc.text("BA-DIABY EXPRESS", 41, 15);
  doc.setFontSize(9.5); doc.setFont(undefined, "normal"); doc.setTextColor(190, 205, 228);
  doc.text("Mon bordereau personnel", 41, 21.5);
  doc.setFontSize(8);
  doc.text(`Généré le ${new Date().toLocaleDateString("fr-FR")}`, 41, 27);

  let y = 46;
  doc.setTextColor(...INK); doc.setFont(undefined, "bold"); doc.setFontSize(13);
  doc.text(`${compte.prenom} ${compte.nom}`, M, y);
  y += 5.5;
  doc.setFont(undefined, "normal"); doc.setFontSize(9.5); doc.setTextColor(...MUTED);
  doc.text(compte.telephone || "—", M, y);
  y += 10;

  // ── Bandeau de synthèse ───────────────────────────────────────────────────
  const totalPoids = colisListe.reduce((s, c) => s + (Number(c.poids) || 0), 0);
  const totalReste = colisListe.reduce((s, c) => s + (Number(c.reste) || 0), 0);
  doc.setFillColor(...TINT); doc.roundedRect(M, y, W - 2 * M, 16, 3, 3, "F");
  doc.setFont(undefined, "bold"); doc.setFontSize(10); doc.setTextColor(...INK);
  doc.text(`${colisListe.length} colis · ${totalPoids.toFixed(1)} kg au total`, M + 6, y + 10);
  doc.setTextColor(...(totalReste > 0 ? [178, 36, 58] : [16, 116, 66]));
  doc.text(totalReste > 0 ? `Reste à payer : ${fmt(totalReste, devise)}` : "Tout est payé", W - M - 6, y + 10, { align: "right" });
  y += 24;

  // ── Tableau des colis ─────────────────────────────────────────────────────
  if (colisListe.length === 0) {
    doc.setFont(undefined, "normal"); doc.setFontSize(10); doc.setTextColor(...MUTED);
    doc.text("Aucun colis enregistré à votre nom pour le moment.", M, y + 6);
  } else {
    y = enTeteTableau(y);
    doc.setFont(undefined, "normal"); doc.setFontSize(8.2);
    colisListe.forEach((c, i) => {
      if (y + 9 > H - 22) {            // place réservée au pied de page
        doc.addPage();
        y = enTeteTableau(20);
        doc.setFont(undefined, "normal"); doc.setFontSize(8.2);
      }
      if (i % 2 === 1) { doc.setFillColor(248, 250, 253); doc.rect(M, y, largeurTotale, 8, "F"); }
      let x = M;
      COLONNES.forEach((col) => {
        doc.setTextColor(...INK);
        const brut = String(col.cle(c) ?? "");
        let texte = brut;
        while (texte.length > 3 && doc.getTextWidth(texte) > col.largeur - 4) texte = texte.slice(0, -1);
        if (texte !== brut) texte = texte.slice(0, -1) + "\u2026";
        doc.text(texte, col.droite ? x + col.largeur - 2 : x + 2, y + 5.4, col.droite ? { align: "right" } : undefined);
        x += col.largeur;
      });
      doc.setDrawColor(...LINE); doc.setLineWidth(0.2); doc.line(M, y + 8, M + largeurTotale, y + 8);
      y += 8;
    });
  }

  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) { doc.setPage(p); piedDePage(p, total); }

  openPdf(doc, `mon-bordereau-${compte.nom}.pdf`);
}

async function downloadReceptionBordereau(compte, colisSelectionnes, tarifs) {
  const jspdf = await loadJsPDF();
  const doc = preparerDocPdf(new jspdf.jsPDF());
  const poidsTotal = colisSelectionnes.reduce((s, c) => s + (Number(c.poids) || 0), 0);
  const { tauxParKg, total, palier: palierUtilise } = calcReceptionFee(poidsTotal, tarifs);
  const numero = `REC-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(Date.now()).slice(-4)}`;

  doc.setFillColor(10, 38, 71); doc.rect(0, 0, 210, 32, "F");
  doc.setFillColor(255, 255, 255); doc.roundedRect(14, 6, 22, 22, 3, 3, "F");
  doc.addImage(DEFAULT_LOGO, "PNG", 15.3, 7.3, 19.4, 19.4);
  doc.setTextColor(255, 255, 255); doc.setFont(undefined, "bold"); doc.setFontSize(15);
  doc.text("BA-DIABY EXPRESS", 41, 15);
  doc.setFont(undefined, "normal"); doc.setFontSize(9.5); doc.setTextColor(180, 195, 220);
  doc.text("Bordereau de réception client", 41, 21.5);
  doc.setFontSize(8); doc.text(`N° ${numero} · ${new Date().toLocaleDateString("fr-FR")}`, 41, 27);

  let y = 42;
  doc.setTextColor(10, 38, 71); doc.setFont(undefined, "bold"); doc.setFontSize(10);
  doc.text("CLIENT", 14, y);
  y += 6;
  doc.setTextColor(30, 30, 30); doc.setFont(undefined, "bold"); doc.setFontSize(12);
  doc.text(`${compte.prenom} ${compte.nom}`, 14, y);
  y += 5.5;
  doc.setFont(undefined, "normal"); doc.setFontSize(9); doc.setTextColor(100, 100, 100);
  doc.text(compte.telephone || "—", 14, y);
  y += 10;
  doc.setDrawColor(220); doc.line(14, y, 196, y);
  y += 8;

  doc.setFont(undefined, "bold"); doc.setFontSize(10); doc.setTextColor(10, 38, 71);
  doc.text(`COLIS DISPONIBLES SÉLECTIONNÉS (${colisSelectionnes.length})`, 14, y);
  y += 3;

  const hasAutoTable = await ensureAutoTable();
  const rows = colisSelectionnes.map((c) => [c.tracking, c.destinataire, routeLabel(c.pays, c.direction), `${c.poids} kg`]);
  if (hasAutoTable && doc.autoTable) {
    doc.autoTable({
      startY: y + 4, head: [["N° de suivi", "Destinataire", "Route", "Poids"]], body: rows,
      theme: "grid", headStyles: { fillColor: [10, 38, 71], textColor: 255, fontSize: 8.5 }, styles: { fontSize: 8.5, textColor: [40, 40, 40] },
      margin: { left: 14, right: 14 },
    });
    y = doc.lastAutoTable.finalY + 10;
  } else {
    y += 8;
    rows.forEach((r) => { doc.setFontSize(9); doc.setTextColor(40, 40, 40); doc.text(`${r[0]} — ${r[1]} — ${r[3]}`, 14, y); y += 6; });
    y += 4;
  }

  doc.setFillColor(245, 247, 251); doc.rect(14, y, 182, 34, "F");
  doc.setFont(undefined, "normal"); doc.setFontSize(9.5); doc.setTextColor(90, 90, 90);
  doc.text("Poids total du lot", 20, y + 10);
  doc.text(`Tarif appliqué (palier jusqu’à ${palierUtilise?.max ?? "?"} kg)`, 20, y + 18);
  doc.setFont(undefined, "bold"); doc.setFontSize(10.5); doc.setTextColor(20, 20, 20);
  doc.text(`${poidsTotal.toFixed(1)} kg`, 190, y + 10, { align: "right" });
  doc.text(`${tauxParKg.toLocaleString("fr-FR")} GNF / kg`, 190, y + 18, { align: "right" });
  doc.setDrawColor(200); doc.line(20, y + 23, 190, y + 23);
  doc.setFont(undefined, "bold"); doc.setFontSize(13); doc.setTextColor(10, 38, 71);
  doc.text("TOTAL À PAYER", 20, y + 30);
  doc.text(`${total.toLocaleString("fr-FR")} GNF`, 190, y + 30, { align: "right" });
  y += 44;

  doc.setFontSize(7.5); doc.setTextColor(140, 140, 140); doc.setFont(undefined, "normal");
  doc.text("Ce bordereau récapitule les colis disponibles à la récupération et le montant à régler à l’agence.", 14, y);
  doc.text("Ba-Diaby Express — Transport de colis Conakry - Monde · badiabyexpress.bde@gmail.com", 14, y + 5);

  openPdf(doc, `bordereau-reception-${compte.nom}-${numero}.pdf`);
}

async function downloadRouteManifest(colisRoute, country, direction, bordereau, deviseAffichage) {
  const cur = deviseAffichage || country.currency;
  const jspdf = await loadJsPDF();
  const doc = preparerDocPdf(new jspdf.jsPDF());
  const label = direction === "import" ? `${country.city} → Conakry` : `Conakry → ${country.city}`;
  const poidsTotal = colisRoute.reduce((s, c) => s + c.poids, 0);

  // Bandeau d’en-tête
  doc.setFillColor(10, 38, 71); doc.rect(0, 0, 210, 30, "F");
  doc.setFillColor(255, 255, 255); doc.roundedRect(14, 5, 20, 20, 2.5, 2.5, "F");
  doc.addImage(DEFAULT_LOGO, "PNG", 15, 6, 18, 18);
  doc.setTextColor(255, 255, 255); doc.setFont(undefined, "bold"); doc.setFontSize(15);
  doc.text("BA-DIABY EXPRESS", 37, 13);
  doc.setFont(undefined, "normal"); doc.setFontSize(9); doc.setTextColor(180, 195, 220);
  doc.text(`Bordereau d’expédition${bordereau?.numero ? ` — ${bordereau.numero}` : ""}`, 37, 19.5);
  doc.setFontSize(8); doc.text(`Route : ${label} · Généré le ${new Date().toLocaleDateString("fr-FR")}`, 37, 25);
  if (bordereau?.statut) {
    doc.setFillColor(bordereau.statut === "Reçu" ? 62 : 91, bordereau.statut === "Reçu" ? 203 : 141, bordereau.statut === "Reçu" ? 132 : 239);
    doc.roundedRect(170, 9, 26, 8, 4, 4, "F");
    doc.setFontSize(8); doc.setTextColor(255, 255, 255); doc.setFont(undefined, "bold");
    doc.text(bordereau.statut.toUpperCase(), 183, 14.3, { align: "center" });
  }

  // Cartes statistiques
  let y = 38;
  const stat = (x, label2, value) => {
    doc.setFillColor(240, 243, 250); doc.roundedRect(x, y, 58, 18, 2, 2, "F");
    doc.setFontSize(7.5); doc.setTextColor(120, 130, 150); doc.setFont(undefined, "normal");
    doc.text(label2, x + 4, y + 6.5);
    doc.setFontSize(12); doc.setTextColor(10, 38, 71); doc.setFont(undefined, "bold");
    doc.text(String(value), x + 4, y + 14);
  };
  stat(14, "COLIS", colisRoute.length);
  stat(76, "POIDS TOTAL", `${poidsTotal.toFixed(1)} kg`);
  stat(138, "MONTANT TOTAL", fmt(colisRoute.reduce((s, c) => s + c.prix, 0), cur));
  y += 26;

  const head = ["N° de suivi", "Destinataire", "Téléphone", "Mode", "Poids", "Statut", `Montant (${cur})`];
  const body = colisRoute.map((c) => [
    c.tracking, c.destinataire, c.telephone, c.mode === "air" ? "Aérien" : "Maritime",
    `${c.poids} kg`, c.status, fmt(c.prix, cur),
  ]);

  const hasAutoTable = await ensureAutoTable();
  let finalY = y;
  if (hasAutoTable && doc.autoTable) {
    doc.autoTable({
      startY: y, head: [head], body,
      headStyles: { fillColor: [10, 38, 71], fontSize: 8.5 },
      bodyStyles: { fontSize: 8.5, textColor: [30, 40, 55] },
      alternateRowStyles: { fillColor: [238, 243, 250] },
      margin: { left: 14, right: 14 },
    });
    finalY = doc.lastAutoTable.finalY || y + 8;
  } else {
    // manual fallback table if the autoTable plugin could not be loaded
    const colX = [14, 55, 90, 125, 148, 168, 185];
    doc.setFontSize(8); doc.setTextColor(255, 255, 255); doc.setFillColor(10, 38, 71);
    doc.rect(14, finalY, 182, 7, "F");
    head.forEach((h, i) => doc.text(h, colX[i] + 1, finalY + 5));
    finalY += 9;
    doc.setTextColor(30, 40, 55);
    body.forEach((row, i) => {
      if (finalY > 275) { doc.addPage(); finalY = 20; }
      if (i % 2 === 1) { doc.setFillColor(238, 243, 250); doc.rect(14, finalY - 4.5, 182, 6.5, "F"); }
      row.forEach((cell, j) => doc.text(String(cell).slice(0, 16), colX[j] + 1, finalY));
      finalY += 6.5;
    });
    finalY += 6;
  }

  const totalFacture = colisRoute.reduce((s, c) => s + c.prix, 0);
  const totalEncaisse = colisRoute.reduce((s, c) => s + c.paye, 0);
  const totalRestant = colisRoute.reduce((s, c) => s + c.reste, 0);
  doc.setFillColor(245, 247, 251); doc.rect(14, finalY + 5, 182, 12, "F");
  doc.setFontSize(9); doc.setFont(undefined, "bold"); doc.setTextColor(10, 38, 71);
  doc.text(`Facturé : ${fmt(totalFacture, cur)}`, 18, finalY + 12.5);
  doc.setTextColor(62, 160, 90);
  doc.text(`Encaissé : ${fmt(totalEncaisse, cur)}`, 85, finalY + 12.5);
  doc.setTextColor(226, 63, 82);
  doc.text(`Reste à percevoir : ${fmt(totalRestant, cur)}`, 150, finalY + 12.5);

  const sigY = finalY + 30;
  doc.setFont(undefined, "normal"); doc.setFontSize(9); doc.setTextColor(90, 100, 120);
  doc.text("Signature de l’agent :", 14, sigY);
  doc.setDrawColor(180); doc.line(14, sigY + 14, 85, sigY + 14);
  doc.text("Signature du transporteur :", 110, sigY);
  doc.line(110, sigY + 14, 181, sigY + 14);

  doc.setFontSize(7.3); doc.setTextColor(150, 150, 150);
  doc.text("Ba-Diaby Express — Transport de colis Conakry - Monde · badiabyexpress.bde@gmail.com", 14, 288);

  openPdf(doc, `bordereau-${bordereau?.numero || `${country.code}-${direction}`}-${new Date().toISOString().slice(0, 10)}.pdf`);
}

async function downloadLabel(colis) {
  const jspdf = await loadJsPDF();
  const doc = preparerDocPdf(new jspdf.jsPDF({ unit: "mm", format: [100, 150] }));
  // colis.pays est le pays de route (origine pour un import) ; le pays réellement affiché comme
  // destination sur l'étiquette doit être celui du destinataire (toujours la Guinée à l'import).
  const dest = COUNTRIES.find((c) => c.code === (colis.destinatairePays || colis.pays));
  const trackingUrl = trackingUrlFor(colis.tracking);
  const [qrData, barcodeData] = await Promise.all([
    generateQRDataUrl(trackingUrl, 300),
    generateBarcodeDataUrl(colis.tracking).catch(() => null),
  ]);
  const paye = colis.reste <= 0;
  const W = 100, H = 150, M = 6;
  const NAVY = [10, 38, 71], RED = [214, 39, 63], INK = [17, 20, 26], MUTED = [128, 136, 150], LINE = [225, 228, 234];

  /*
   * MISE EN PAGE À ZONES FIXES.
   *
   * L'ancienne version empilait les blocs les uns après les autres en cumulant une position
   * verticale. Dès que le nom du destinataire tenait sur deux lignes, le bas de l'étiquette
   * dépassait les 150 mm : le code-barres, les poids et le bandeau finissaient hors du papier.
   * Mesuré : dépassement de 0,3 mm avec un nom sur 2 lignes, jusqu'à 19,7 mm avec une longue
   * adresse — c'est-à-dire une étiquette inutilisable en entrepôt.
   *
   * Chaque bloc a désormais une position FIXE, comme sur les étiquettes des transporteurs
   * internationaux. Le code-barres et le numéro de suivi se trouvent toujours au même endroit,
   * quelle que soit la longueur des noms — indispensable pour un scan rapide et régulier.
   * Le texte trop long est tronqué proprement plutôt que de pousser le reste hors de la page.
   */
  const Z = {
    filetHaut: 21.5,     // trait rouge sous l'en-tête
    statut: 27.5,        // ligne "payé / non payé" + route
    sepStatut: 30.5,
    destinataire: 30.5,  // début de la zone destinataire
    destMax: 79,         // plafond : au-delà, le contenu est tronqué
    qrMax: 79.5,         // le bloc QR ne descend jamais plus bas que ça
    sepQr: 104,
    codeBarres: 105,     // code-barres (11 mm) puis numéro
    sepCode: 120.5,
    expediteur: 120.5,   // zone expéditeur
    sepExp: 132.5,
    stats: 135.5,        // poids / articles / date
    bandeau: 141.5,      // bandeau bleu final (7,5 mm)
  };

  const hr = (y) => { doc.setDrawColor(...LINE); doc.setLineWidth(0.25); doc.line(M, y, W - M, y); };
  const eyebrow = (text, x, y) => { doc.setFont(undefined, "bold"); doc.setFontSize(6.4); doc.setTextColor(...MUTED); doc.text(text.toUpperCase(), x, y); };
  /** Découpe un texte et le limite à maxLignes, la dernière étant suivie de « … » si tronquée. */
  const ajuster = (texte, largeur, maxLignes) => {
    const lignes = doc.splitTextToSize(String(texte || ""), largeur);
    if (lignes.length <= maxLignes) return lignes;
    const gardees = lignes.slice(0, maxLignes);
    gardees[maxLignes - 1] = String(gardees[maxLignes - 1]).replace(/\s+\S*$/, "") + "\u2026";
    return gardees;
  };

  // Cadre extérieur
  doc.setDrawColor(...INK); doc.setLineWidth(0.5); doc.rect(0.6, 0.6, W - 1.2, H - 1.2);

  // ── En-tête : logo + wordmark + mode de transport ──────────────────────────
  doc.addImage(DEFAULT_LOGO, "PNG", M, 4.5, 14, 14);
  doc.setTextColor(...NAVY); doc.setFont(undefined, "bold"); doc.setFontSize(12);
  doc.text("BA-DIABY", M + 17, 10.5);
  doc.setTextColor(...RED);
  doc.text("EXPRESS", M + 17, 16.5);
  const modeLabel = colis.mode === "air" ? "AÉRIEN" : "MARITIME";
  const modeW = doc.getTextWidth(modeLabel) + 11;
  doc.setFillColor(...NAVY); doc.roundedRect(W - M - modeW, 6, modeW, 7, 3.5, 3.5, "F");
  doc.setTextColor(255, 255, 255); doc.setFontSize(7.5); doc.setFont(undefined, "bold");
  doc.text(modeLabel, W - M - modeW / 2, 10.5, { align: "center" });
  doc.setFillColor(...RED); doc.rect(0.6, Z.filetHaut, W - 1.2, 0.8, "F");

  // ── Statut de paiement (pastille pleine, jamais de montant) + route ────────
  const pastille = paye ? "PAYÉ" : "NON PAYÉ";
  doc.setFont(undefined, "bold"); doc.setFontSize(7.6);
  const pW = doc.getTextWidth(pastille) + 8;
  doc.setFillColor(...(paye ? [22, 120, 70] : [190, 30, 45]));
  doc.roundedRect(M, Z.statut - 4.2, pW, 6, 3, 3, "F");
  doc.setTextColor(255, 255, 255);
  doc.text(pastille, M + pW / 2, Z.statut, { align: "center" });
  doc.setFont(undefined, "bold"); doc.setFontSize(7.5); doc.setTextColor(...MUTED);
  doc.text(`GN-${colis.pays}`, W - M, Z.statut, { align: "right" });
  hr(Z.sepStatut);

  // ── Destinataire (zone fixe : le texte s'adapte, la zone ne bouge pas) ─────
  let y = Z.destinataire + 4.5;
  eyebrow("Livrer à / Deliver to", M, y);
  y += 5.5;
  doc.setTextColor(...INK); doc.setFont(undefined, "bold"); doc.setFontSize(13.5);
  const nomLines = ajuster(String(colis.destinataire || "").toUpperCase(), W - 2 * M, 2);
  doc.text(nomLines, M, y);
  y += nomLines.length * 5.2 + 0.5;
  doc.setFont(undefined, "bold"); doc.setFontSize(9.2); doc.setTextColor(35, 42, 55);
  doc.text(colis.telephone || "—", M, y);
  y += 4.2;
  if (colis.destinataireEmail) {
    doc.setFont(undefined, "normal"); doc.setFontSize(7.4); doc.setTextColor(...MUTED);
    doc.text(ajuster(colis.destinataireEmail, W - 2 * M, 1), M, y);
    y += 3.6;
  }
  y += 1.5;
  doc.setFont(undefined, "normal"); doc.setFontSize(8); doc.setTextColor(...INK);
  if (colis.destinataireAdresse) {
    const addrLines = ajuster(colis.destinataireAdresse, W - 2 * M, 3);
    doc.text(addrLines, M, y);
    y += addrLines.length * 3.7;
  }
  const villeCp = [colis.destinataireCodePostal, colis.destinataireVille].filter(Boolean).join(" ");
  if (villeCp) { doc.text(ajuster(villeCp, W - 2 * M, 1), M, y); y += 3.7; }
  doc.setFont(undefined, "bold"); doc.setFontSize(9.5); doc.setTextColor(...NAVY);
  const yPays = Math.min(y + 1, Z.destMax - 2);
  doc.text(ajuster((dest?.name || "").toUpperCase(), W - 2 * M, 1), M, yPays);

  /*
   * Le bloc QR suit immédiatement l'adresse au lieu d'être figé plus bas : avec une adresse
   * courte, la zone fixe laissait un grand vide au milieu de l'étiquette. Il reste plafonné
   * (Z.qrMax) pour qu'une adresse longue ne vienne jamais pousser le code-barres, dont la
   * position doit rester constante pour un scan régulier en entrepôt.
   */
  const ySep = Math.min(yPays + 3, Z.destMax);
  hr(ySep);
  const yQr = Math.min(ySep + 3.5, Z.qrMax);

  const qrSize = 23;
  doc.setDrawColor(...LINE); doc.setLineWidth(0.3); doc.rect(M, yQr, qrSize, qrSize);
  doc.addImage(qrData, "PNG", M + 0.6, yQr + 0.6, qrSize - 1.2, qrSize - 1.2);
  const txX = M + qrSize + 6;
  eyebrow("Code de suivi", txX, yQr + 7);
  doc.setTextColor(...INK); doc.setFont(undefined, "bold"); doc.setFontSize(15);
  doc.text(colis.tracking, txX, yQr + 15.5);
  if (colis.referenceCommande) {
    doc.setFont(undefined, "bold"); doc.setFontSize(7); doc.setTextColor(...INK);
    doc.text(ajuster(`Réf. commande : ${colis.referenceCommande}`, W - M - txX - 2, 1), txX, yQr + 19.5);
  }
  doc.setFont(undefined, "normal"); doc.setFontSize(6.6); doc.setTextColor(...MUTED);
  doc.text(ajuster("Scannez pour suivre le colis en direct", W - M - txX - 2, 1), txX, yQr + (colis.referenceCommande ? 23 : 20));
  hr(Math.min(yQr + qrSize + 2.5, Z.sepQr));

  // ── Code-barres Code128 (position garantie pour un scan régulier) ──────────
  if (barcodeData) doc.addImage(barcodeData, "PNG", M, Z.codeBarres, W - 2 * M, 11);
  doc.setFont(undefined, "bold"); doc.setFontSize(8); doc.setTextColor(...INK);
  doc.text(colis.tracking, W / 2, Z.codeBarres + 14.5, { align: "center" });
  hr(Z.sepCode);

  // ── Expéditeur ────────────────────────────────────────────────────────────
  eyebrow("Expéditeur / From", M, Z.expediteur + 4);
  doc.setTextColor(...INK); doc.setFont(undefined, "bold"); doc.setFontSize(9);
  doc.text(ajuster(colis.expediteur, W - 2 * M - 26, 1), M, Z.expediteur + 8);
  doc.setFont(undefined, "normal"); doc.setFontSize(7.6);
  doc.text(colis.expediteurTelephone || "", W - M, Z.expediteur + 8, { align: "right" });
  if (colis.expediteurAdresse) {
    doc.setFontSize(6.9); doc.setTextColor(...MUTED);
    doc.text(ajuster(colis.expediteurAdresse, W - 2 * M, 1), M, Z.expediteur + 11.2);
  }
  hr(Z.sepExp);

  // ── Poids / Articles / Date ───────────────────────────────────────────────
  const articles = (colis.produits || []).reduce((s, p) => s + (Number(p.quantite) || 1), 0) || 1;
  const stats = [["POIDS", `${colis.poids} kg`], ["ARTICLES", String(articles)], ["ENREGISTRÉ", new Date(colis.createdAt).toLocaleDateString("fr-FR")]];
  const colW = (W - 2 * M) / 3;
  stats.forEach(([label, value], i) => {
    const cx = M + colW * i + colW / 2;
    doc.setFont(undefined, "bold"); doc.setFontSize(6.2); doc.setTextColor(...MUTED);
    doc.text(label, cx, Z.stats, { align: "center" });
    doc.setFontSize(9.4); doc.setTextColor(...INK);
    doc.text(value, cx, Z.stats + 4.5, { align: "center" });
    if (i > 0) { doc.setDrawColor(...LINE); doc.line(M + colW * i, Z.stats - 3, M + colW * i, Z.stats + 5.5); }
  });

  // ── Bandeau final : route + site (deux informations en un seul bloc) ───────
  doc.setFillColor(...NAVY); doc.rect(0.6, Z.bandeau, W - 1.2, 7.5, "F");
  doc.setTextColor(255, 255, 255); doc.setFont(undefined, "bold"); doc.setFontSize(7.4);
  doc.text(routeLabel(colis.pays, colis.direction).toUpperCase(), W / 2, Z.bandeau + 3.4, { align: "center" });
  doc.setFontSize(5.8); doc.setTextColor(178, 196, 222);
  doc.text("WWW.BA-DIABY-EXPRESS.COM · TRANSPORT SOUMIS AUX CGV BA-DIABY EXPRESS", W / 2, Z.bandeau + 6.4, { align: "center" });

  openPdf(doc, `etiquette-${colis.tracking}.pdf`);
}

/** Reçu d’encaissement PDF pour un paiement précis — utile pour la comptabilité et le client. */
async function downloadRecu(colis, paiement) {
  const jspdf = await loadJsPDF();
  const doc = preparerDocPdf(new jspdf.jsPDF({ unit: "mm", format: "a5" }));
  const W = 148, H = 210, M = 10;
  const qrData = await generateQRDataUrl(`${colis.tracking}-${paiement.id}`, 200).catch(() => null);

  /*
   * Positions FIXES, comme pour l'étiquette. Auparavant chaque ligne d'information poussait la
   * suivante vers le bas : un paiement Mobile Money complet (référence + numéro du payeur +
   * numéro receveur, soit huit lignes) faisait sortir le trait de signature à 210 mm — hors du
   * cadre — et le pied de page venait se superposer au bloc signature. C'est le cas le plus
   * fréquent chez vous, donc le plus gênant.
   */
  const Z = { entete: 29, montant: 42, sepMontant: 68, infos: 76, ligne: 11, maxLignes: 8,
              sepBas: 168, signature: 174, traitSignature: 188, pied: 196 };

  /** Tronque proprement une valeur trop longue pour la largeur disponible. */
  const ajuster = (texte, largeur) => {
    const t = String(texte ?? "—");
    if (doc.getTextWidth(t) <= largeur) return t;
    let coupe = t;
    while (coupe.length > 4 && doc.getTextWidth(coupe + "\u2026") > largeur) coupe = coupe.slice(0, -1);
    return coupe + "\u2026";
  };

  doc.setDrawColor(20, 20, 20); doc.setLineWidth(0.5); doc.rect(3, 3, W - 6, H - 6);

  // ── En-tête ───────────────────────────────────────────────────────────────
  doc.setFillColor(10, 38, 71); doc.rect(3, 3, W - 6, 26, "F");
  doc.setFillColor(255, 255, 255); doc.roundedRect(8, 6, 20, 20, 2.5, 2.5, "F");
  doc.addImage(DEFAULT_LOGO, "PNG", 9, 7, 18, 18);
  doc.setTextColor(255, 255, 255); doc.setFontSize(13); doc.setFont(undefined, "bold");
  doc.text("BA-DIABY EXPRESS", 31, 13);
  doc.setFontSize(8.5); doc.setFont(undefined, "normal"); doc.setTextColor(180, 195, 220);
  doc.text("Reçu d’encaissement", 31, 19);
  doc.setFontSize(7.5); doc.text(`N° REÇ-${paiement.id.replace(/\D/g, "").slice(-8)}`, W - M, 19, { align: "right" });

  // ── Montant mis en avant ──────────────────────────────────────────────────
  doc.setTextColor(120, 120, 120); doc.setFontSize(8.5); doc.setFont(undefined, "normal");
  doc.text("MONTANT REÇU", M, Z.montant);
  doc.setTextColor(22, 120, 70); doc.setFont(undefined, "bold"); doc.setFontSize(20);
  doc.text(paiement.deviseSaisie ? fmt(paiement.montant, paiement.deviseSaisie) : fmt(paiement.montant, "EUR"), M, Z.montant + 10);
  if (paiement.deviseSaisie && paiement.deviseSaisie !== "EUR") {
    doc.setFontSize(9); doc.setTextColor(120, 120, 120); doc.setFont(undefined, "normal");
    doc.text(`Soit environ ${fmt(paiement.montant, "EUR")}`, M, Z.montant + 17);
  }
  if (qrData) doc.addImage(qrData, "PNG", W - 38, Z.montant - 6, 26, 26);
  doc.setDrawColor(220); doc.line(M, Z.sepMontant, W - M, Z.sepMontant);

  // ── Détail du paiement (nombre de lignes borné) ───────────────────────────
  const infos = [
    ["Colis concerné", `${colis.tracking} — ${colis.destinataire}`],
    ["Mode de paiement", paiement.mode],
    paiement.reference ? ["Référence de transaction", paiement.reference] : null,
    paiement.numeroPayeur ? ["Numéro du payeur", paiement.numeroPayeur] : null,
    paiement.numeroReceveur ? ["Numéro receveur (agence)", paiement.numeroReceveur] : null,
    ["Date et heure", new Date(paiement.date).toLocaleString("fr-FR")],
    ["Encaissé par", paiement.par || "—"],
    ["Reste à payer après ce paiement", fmt(colis.reste, "EUR")],
  ].filter(Boolean).slice(0, Z.maxLignes);

  const largeurUtile = W - 2 * M;
  infos.forEach(([label, valeur], i) => {
    const y = Z.infos + i * Z.ligne;
    doc.setFontSize(8.5); doc.setTextColor(120, 120, 120); doc.setFont(undefined, "normal");
    doc.text(label, M, y);
    doc.setFontSize(10.5); doc.setTextColor(20, 20, 20); doc.setFont(undefined, "bold");
    doc.text(ajuster(valeur, largeurUtile), M, y + 5);
  });

  // ── Signature et pied de page : toujours au même endroit ───────────────────
  doc.setDrawColor(200); doc.line(M, Z.sepBas, W - M, Z.sepBas);
  doc.setFontSize(8.5); doc.setTextColor(90, 90, 90); doc.setFont(undefined, "normal");
  doc.text("Signature / cachet de l’agence :", M, Z.signature);
  doc.setDrawColor(150); doc.line(M, Z.traitSignature, 65, Z.traitSignature);
  doc.setFontSize(7.3); doc.setTextColor(140, 140, 140);
  doc.text("Ce reçu fait foi d’encaissement pour la comptabilité de Ba-Diaby Express.", M, Z.pied);
  doc.text("badiabyexpress.bde@gmail.com · www.ba-diaby-express.com", M, Z.pied + 4);

  openPdf(doc, `recu-${colis.tracking}-${paiement.id}.pdf`);
}

/** Bon de sortie PDF — preuve de remise du colis à la personne qui l’a récupéré. */
async function downloadBonSortie(colis) {
  /*
   * Deux sources possibles : la preuve de remise saisie au moment de marquer « Livré » (voie
   * normale depuis l'ajout du contrôle), ou l'ancien bon de sortie rempli à la main. On accepte
   * les deux pour ne pas perdre les colis déjà traités avant ce changement.
   */
  const remise = colis.remise || colis.bonSortie;
  if (!remise) return;
  const jspdf = await loadJsPDF();
  const doc = preparerDocPdf(new jspdf.jsPDF({ unit: "mm", format: "a5" }));
  doc.setFillColor(10, 38, 71); doc.rect(0, 0, 148, 22, "F");
  doc.setFillColor(255, 255, 255); doc.roundedRect(8, 3.5, 16, 16, 2, 2, "F");
  doc.addImage(DEFAULT_LOGO, "PNG", 9, 4.5, 14, 14);
  doc.setTextColor(255, 255, 255); doc.setFontSize(13); doc.setFont(undefined, "bold");
  doc.text("BA-DIABY EXPRESS", 27, 11);
  doc.setFontSize(8.5); doc.setFont(undefined, "normal"); doc.text("Bon de sortie", 27, 16.5);

  doc.setTextColor(20, 20, 20);
  /*
   * Positions fixes. Auparavant les sept lignes descendaient jusqu'à 122 mm alors que le trait
   * de pied de page était figé à 128 mm : il traversait la dernière ligne, et le bloc signature
   * (140 mm) se retrouvait imprimé APRÈS le pied de page. La page A5 fait 210 mm : il y avait
   * largement la place, la mise en page était simplement héritée d'un format plus court.
   */
  const ZB = { debut: 32, pas: 11, sepBas: 112, signature: 120, traitSignature: 136, sepPied: 190, pied: 196 };
  const largeurBS = 148 - 20;
  let y = ZB.debut;
  const line = (label, value) => {
    doc.setFontSize(9); doc.setTextColor(120, 120, 120); doc.text(label, 10, y);
    doc.setFontSize(11); doc.setTextColor(20, 20, 20);
    let v = String(value || "—");
    if (doc.getTextWidth(v) > largeurBS) {
      while (v.length > 3 && doc.getTextWidth(v + "\u2026") > largeurBS) v = v.slice(0, -1);
      v += "\u2026";
    }
    doc.text(v, 10, y + 6);
    y += ZB.pas;
  };
  line("Colis", `${colis.tracking}`);
  line("Destinataire prévu", colis.destinataire);
  line("Récupéré par", remise.nom);
  line("Emplacement en entrepôt", colis.emplacement);
  line("Pièce d’identité", remise.piece || (remise.typePiece ? `${remise.typePiece}${remise.numeroPiece ? " " + remise.numeroPiece : ""}` : ""));
  line("Date de remise", remise.date ? new Date(remise.date).toLocaleString("fr-FR") : "—");
  line("Enregistré par", remise.enregistrePar || remise.agent);

  doc.setDrawColor(220); doc.line(10, ZB.sepBas, 138, ZB.sepBas);
  doc.setFontSize(9); doc.setTextColor(90, 90, 90);
  /*
   * Si la remise a déjà été enregistrée dans l'application, on imprime la personne, sa qualité
   * et sa pièce d'identité : le bon devient une vraie preuve, pas seulement une case à signer.
   * Sinon on garde la ligne vierge, pour le cas où l'agent imprime avant de remettre.
   */
  if (colis.remise) {
    doc.setFontSize(8); doc.setTextColor(120, 120, 120);
    doc.text("Remis à", 10, ZB.signature - 8);
    doc.setFontSize(9.5); doc.setTextColor(30, 30, 30); doc.setFont(undefined, "bold");
    const qualite = colis.remise.lien === "proche" ? " (un proche)" : colis.remise.lien === "mandataire" ? " (mandataire)" : "";
    doc.text(`${colis.remise.nom}${qualite}`, 10, ZB.signature - 3);
    doc.setFont(undefined, "normal"); doc.setFontSize(8.5); doc.setTextColor(90, 90, 90);
    const piece = colis.remise.typePiece
      ? `${colis.remise.typePiece}${colis.remise.numeroPiece ? " " + colis.remise.numeroPiece : ""}`
      : "Aucune pièce présentée";
    doc.text(piece, 10, ZB.signature + 2);
    doc.text(`Le ${new Date(colis.remise.date).toLocaleString("fr-FR")} · agent : ${colis.remise.agent}`, 10, ZB.signature + 7);
    doc.setFontSize(9); doc.setTextColor(120, 120, 120);
    doc.text("Signature :", 10, ZB.signature + 15);
    doc.setDrawColor(150); doc.line(10, ZB.traitSignature + 8, 90, ZB.traitSignature + 8);
  } else {
  doc.text("Signature de la personne qui récupère :", 10, ZB.signature);
  doc.setDrawColor(150); doc.line(10, ZB.traitSignature, 90, ZB.traitSignature);
  }

  doc.setDrawColor(200); doc.line(10, ZB.sepPied, 138, ZB.sepPied);
  doc.setFontSize(7.5); doc.setTextColor(120, 120, 120);
  doc.text("Ce document atteste la remise du colis. À conserver avec les pièces comptables.", 10, ZB.pied);
  openPdf(doc, `bon-de-sortie-${colis.tracking}.pdf`);
}

/**
 * Ticket d’envoi A4 — design premium (bleu ciel / rouge / blanc / gris clair), plus de bandeau
 * bleu marine plein. Les coordonnées d’agence (origine ET réception à destination) sont
 * récupérées automatiquement depuis la base de données (data.sites / data.agencesReception),
 * selon l’agence d’enregistrement du colis et son pays de destination.
 */
/**
 * Génère la facture du colis.
 *
 * `options.retourner` demande le PDF en base64 au lieu de l'ouvrir : c'est ce qui permet de le
 * joindre à un e-mail. Le document est identique dans les deux cas — une seule mise en page à
 * maintenir, donc aucun risque que la facture envoyée diffère de celle imprimée.
 */
/**
 * Ticket d'envoi — une seule page A4, jamais de débordement.
 *
 * L'ancienne version empilait les blocs les uns après les autres : avec plusieurs produits, un
 * nom long ou une remise, le contenu passait en page 2 et le client recevait un document coupé.
 *
 * Ici chaque zone a une position FIXE en millimètres, et le tableau des produits dispose d'une
 * hauteur bornée : au-delà de 8 lignes, les articles restants sont résumés sur une ligne plutôt
 * que de pousser le reste hors de la page. Le document tient toujours sur une feuille.
 *
 * `options.retourner` renvoie le PDF en base64 au lieu de l'ouvrir, pour l'envoi par e-mail.
 */
async function downloadInvoice(colis, data, options = {}) {
  const jspdf = await loadJsPDF();
  const doc = preparerDocPdf(new jspdf.jsPDF());
  const W = 210, H = 297, M = 16;
  const NAVY = [10, 38, 71], INK = [26, 30, 38], MUTED = [125, 133, 145], LINE = [226, 230, 236];
  const TINT = [244, 247, 251];

  // colis.pays est le pays de route (l'origine pour un import) ; le destinataire réel — et donc
  // sa devise affichée — doit suivre colis.destinatairePays quand il est renseigné (toujours la
  // Guinée pour un import).
  const dest = COUNTRIES.find((c) => c.code === (colis.destinatairePays || colis.pays));
  const origine = COUNTRIES.find((c) => c.code === (colis.direction === "import" ? colis.pays : "GN"));
  const gnf = LIVE_RATES.GNF || CURRENCIES.GNF;
  /*
   * Devise principale du ticket = celle de l'expéditeur : un colis qui part de Conakry se paie en
   * GNF, un colis qui part de France/États-Unis/Maroc... se paie dans la devise de ce pays. La
   * devise secondaire (l'équivalent affiché en petit) est celle du destinataire — GNF pour un
   * import qui arrive en Guinée, la devise du pays étranger pour un export. Les deux ne sont
   * affichées ensemble que si elles diffèrent.
   */
  const primaryCur = COUNTRIES.find((c) => c.code === (colis.expediteurPays || "GN"))?.currency || "GNF";
  const secondaryCur = dest?.currency || "EUR";
  const fmtMontant = (eurValue, cur) => (cur === "GNF" ? fmtGNF(eurValue * gnf) : fmt(eurValue, cur));

  // Zones fixes : chaque bloc sait où il commence, aucun décalage cumulé possible.
  const Z = {
    entete: 0, bandeau: 34, refs: 54, parties: 76, suivi: 108,
    produits: 128, produitsMax: 192, totaux: 197, agences: 252, pied: 288,
  };

  const couper = (texte, largeur) => {
    let t = String(texte ?? "");
    if (doc.getTextWidth(t) <= largeur) return t;
    while (t.length > 1 && doc.getTextWidth(t + "\u2026") > largeur) t = t.slice(0, -1);
    return t + "\u2026";
  };

  // ── En-tête ───────────────────────────────────────────────────────────────
  doc.setFillColor(...NAVY); doc.rect(0, 0, W, Z.bandeau, "F");
  doc.addImage(DEFAULT_LOGO, "PNG", M, 7, 20, 20);
  doc.setTextColor(255, 255, 255); doc.setFont(undefined, "bold"); doc.setFontSize(16);
  doc.text("BA-DIABY EXPRESS", M + 25, 16);
  doc.setFont(undefined, "normal"); doc.setFontSize(9); doc.setTextColor(214, 226, 244);
  doc.text("Transport de colis Conakry - Monde", M + 25, 22.5);
  doc.setFontSize(11); doc.setTextColor(255, 255, 255); doc.setFont(undefined, "bold");
  doc.text("TICKET D'ENVOI", W - M, 16, { align: "right" });
  doc.setFont(undefined, "normal"); doc.setFontSize(8.5); doc.setTextColor(214, 226, 244);
  doc.text(new Date().toLocaleDateString("fr-FR"), W - M, 22.5, { align: "right" });

  // ── État du paiement, en évidence ─────────────────────────────────────────
  const solde = Number(colis.reste) || 0;
  const paye = Number(colis.paye) || 0;
  const etat = solde <= 0.005 ? "PAYÉ" : paye > 0 ? "PARTIELLEMENT PAYÉ" : "NON PAYÉ";
  const etatFond = solde <= 0.005 ? [232, 247, 238] : paye > 0 ? [254, 246, 229] : [253, 235, 238];
  const etatTexte = solde <= 0.005 ? [16, 116, 66] : paye > 0 ? [140, 88, 8] : [178, 36, 58];
  doc.setFillColor(...etatFond); doc.rect(0, Z.bandeau, W, 10, "F");
  doc.setFont(undefined, "bold"); doc.setFontSize(10); doc.setTextColor(...etatTexte);
  doc.text(etat, M, Z.bandeau + 6.8);
  if (solde > 0.005) {
    doc.text(`Reste à payer : ${fmtMontant(solde, primaryCur)}`, W - M, Z.bandeau + 6.8, { align: "right" });
  }

  // ── Références ────────────────────────────────────────────────────────────
  let y = Z.refs;
  const champ = (label, valeur, x, largeur) => {
    doc.setFont(undefined, "normal"); doc.setFontSize(7.5); doc.setTextColor(...MUTED);
    doc.text(label.toUpperCase(), x, y);
    doc.setFont(undefined, "bold"); doc.setFontSize(10); doc.setTextColor(...INK);
    doc.text(couper(valeur, largeur), x, y + 5.5);
  };
  champ("Numéro de suivi", colis.tracking, M, 56);
  champ("Date d'enregistrement", new Date(colis.createdAt).toLocaleDateString("fr-FR"), M + 60, 40);
  champ("Statut", clientStatusLabel(colis.status), M + 104, 40);
  champ("Mode", colis.mode === "air" ? "Aérien" : "Maritime", W - M - 24, 24);
  if (colis.referenceCommande) {
    doc.setFont(undefined, "normal"); doc.setFontSize(7.5); doc.setTextColor(...MUTED);
    doc.text("RÉFÉRENCE COMMANDE", M, y + 12);
    doc.setFont(undefined, "bold"); doc.setFontSize(9); doc.setTextColor(...INK);
    doc.text(couper(colis.referenceCommande, 80), M, y + 16.5);
  }

  // ── Expéditeur / Destinataire ─────────────────────────────────────────────
  y = Z.parties;
  doc.setDrawColor(...LINE); doc.setLineWidth(0.3);
  doc.line(M, y - 6, W - M, y - 6);
  const partie = (titre, nom, tel, pays, x) => {
    doc.setFont(undefined, "bold"); doc.setFontSize(8); doc.setTextColor(...MUTED);
    doc.text(titre.toUpperCase(), x, y);
    doc.setFont(undefined, "bold"); doc.setFontSize(11); doc.setTextColor(...INK);
    doc.text(couper(nom || "—", 82), x, y + 7);
    doc.setFont(undefined, "normal"); doc.setFontSize(9); doc.setTextColor(...MUTED);
    doc.text(tel || "—", x, y + 13);
    doc.text(pays || "—", x, y + 18.5);
  };
  partie("Expéditeur", colis.expediteur, colis.expediteurTelephone, origine?.name, M);
  partie("Destinataire", colis.destinataire, colis.telephone, dest?.name, W / 2 + 2);

  // ── Numéro de suivi mis en avant ──────────────────────────────────────────
  y = Z.suivi;
  doc.setFillColor(...TINT); doc.roundedRect(M, y, W - 2 * M, 18, 3, 3, "F");
  doc.setFont(undefined, "bold"); doc.setFontSize(20); doc.setTextColor(...NAVY);
  doc.text(colis.tracking, W / 2, y + 9, { align: "center" });
  doc.setFont(undefined, "normal"); doc.setFontSize(7.5); doc.setTextColor(...MUTED);
  doc.text("Conservez ce numéro pour suivre votre colis", W / 2, y + 14.5, { align: "center" });

  // ── Produits ──────────────────────────────────────────────────────────────
  y = Z.produits;
  doc.setFont(undefined, "bold"); doc.setFontSize(9); doc.setTextColor(...INK);
  doc.text("DÉTAIL DES ARTICLES", M, y - 4);

  const COLS = [
    { t: "Article", x: M + 2, l: 92 },
    { t: "Qté", x: M + 100, l: 14, d: true },
    { t: "Poids", x: M + 124, l: 22, d: true },
    { t: `Prix (${primaryCur})`, x: M + 150, l: 26, d: true },
  ];
  doc.setFillColor(...NAVY); doc.rect(M, y, W - 2 * M, 8, "F");
  doc.setFont(undefined, "bold"); doc.setFontSize(8); doc.setTextColor(255, 255, 255);
  COLS.forEach((c) => doc.text(c.t, c.d ? c.x + c.l : c.x, y + 5.4, c.d ? { align: "right" } : undefined));
  y += 8;

  const produits = colis.produits || [];
  const MAX_LIGNES = 6;
  const visibles = produits.slice(0, MAX_LIGNES);
  doc.setFont(undefined, "normal"); doc.setFontSize(8.5);
  visibles.forEach((p, i) => {
    if (i % 2 === 1) { doc.setFillColor(249, 251, 253); doc.rect(M, y, W - 2 * M, 8, "F"); }
    doc.setTextColor(...INK);
    doc.text(couper(p.nom || "—", 90), M + 2, y + 5.4);
    doc.text(String(p.quantite || 1), M + 114, y + 5.4, { align: "right" });
    doc.text(`${p.poids || 0} kg`, M + 146, y + 5.4, { align: "right" });
    const ligneGNF = produitValeurGNF(p, data?.categories);
    doc.text(fmtMontant(ligneGNF / gnf, primaryCur), M + 176, y + 5.4, { align: "right" });
    doc.setDrawColor(...LINE); doc.setLineWidth(0.2); doc.line(M, y + 8, W - M, y + 8);
    y += 8;
  });
  if (produits.length > MAX_LIGNES) {
    const reste = produits.length - MAX_LIGNES;
    const poidsReste = produits.slice(MAX_LIGNES).reduce((s, p) => s + (Number(p.poids) || 0), 0);
    doc.setFont(undefined, "italic"); doc.setFontSize(8); doc.setTextColor(...MUTED);
    doc.text(`et ${reste} autre${reste > 1 ? "s" : ""} article${reste > 1 ? "s" : ""} — ${poidsReste.toFixed(2)} kg`, M + 2, y + 5.4);
    y += 8;
  }

  // Récapitulatif quantité / poids, toujours à la même hauteur
  /*
   * Le récapitulatif suit immédiatement le tableau, au lieu d'être ancré en bas de zone : avec
   * peu d'articles, un grand vide s'ouvrait au milieu du ticket et donnait un document bâclé.
   * La zone reste bornée — au pire des cas le récapitulatif atteint Z.produitsMax, jamais plus.
   */
  const totalQte = produits.reduce((s, p) => s + (Number(p.quantite) || 1), 0);
  const yRecap = Math.min(y + 2, Z.produitsMax - 10);
  doc.setFillColor(...TINT); doc.rect(M, yRecap, W - 2 * M, 10, "F");
  doc.setFont(undefined, "bold"); doc.setFontSize(9); doc.setTextColor(...INK);
  doc.text(`${produits.length} référence${produits.length > 1 ? "s" : ""} · ${totalQte} article${totalQte > 1 ? "s" : ""}`, M + 3, yRecap + 6.5);
  doc.text(`Poids total : ${Number(colis.poids || 0).toFixed(2)} kg`, W - M - 3, yRecap + 6.5, { align: "right" });

  // ── Totaux ────────────────────────────────────────────────────────────────
  /*
   * Les totaux sont posés sur un panneau encadré plutôt que sur du blanc : sans cadre, les
   * lignes semblaient flotter au milieu de la page et le bandeau bleu paraissait détaché.
   * Le panneau les rattache visuellement au reste du document.
   */
  y = Z.totaux;
  const panL = W / 2 + 6;
  doc.setFillColor(250, 251, 253);
  doc.setDrawColor(...LINE); doc.setLineWidth(0.3);
  doc.roundedRect(panL - 8, y - 8, W - M - panL + 8, 44, 3, 3, "FD");
  const ligneT = (label, valeur, gras) => {
    doc.setFont(undefined, gras ? "bold" : "normal"); doc.setFontSize(gras ? 9.5 : 8.5);
    doc.setTextColor(...(gras ? INK : MUTED));
    doc.text(label, panL, y);
    doc.text(valeur, W - M, y, { align: "right" });
    y += 5;
  };
  ligneT("Frais d'expédition", fmtMontant(colis.prixBrut || colis.prix, primaryCur));
  if (colis.discountLoyalty > 0) ligneT("Remise fidélité", `-${colis.discountLoyalty} %`);
  if (colis.discountVolume > 0) ligneT("Remise volume", `-${colis.discountVolume} %`);
  const ex = colis.demandeExpress;
  if (ex && ex.facture && ex.montant > 0) ligneT("Livraison express 72h", fmtMontant(ex.montant, primaryCur));

  y += 1;
  doc.setFillColor(...NAVY); doc.rect(panL - 4, y - 4.5, W - M - panL + 4, 11, "F");
  doc.setFont(undefined, "bold"); doc.setFontSize(11); doc.setTextColor(255, 255, 255);
  doc.text("TOTAL À PAYER", panL, y + 2.5);
  doc.text(fmtMontant(colis.prix, primaryCur), W - M, y + 2.5, { align: "right" });
  // L'équivalent dans la devise du destinataire tient dans le bandeau : une ligne de moins, donc plus de marge.
  if (secondaryCur !== primaryCur) {
    doc.setFont(undefined, "normal"); doc.setFontSize(7); doc.setTextColor(205, 218, 236);
    doc.text(`~ ${fmtMontant(colis.prix, secondaryCur)}`, W - M, y + 6, { align: "right" });
  }
  y += 13;
  if (paye > 0) {
    doc.setFont(undefined, "normal"); doc.setFontSize(8.5); doc.setTextColor(...MUTED);
    doc.text("Déjà versé", panL, y);
    doc.text(fmtMontant(paye, primaryCur), W - M, y, { align: "right" });
    y += 5.5;
  }
  if (solde > 0.005) {
    doc.setFont(undefined, "bold"); doc.setFontSize(10); doc.setTextColor(...etatTexte);
    doc.text("Reste à payer", panL, y);
    doc.text(fmtMontant(solde, primaryCur), W - M, y, { align: "right" });
  }

  // ── Agences ───────────────────────────────────────────────────────────────
  y = Z.agences;
  doc.setDrawColor(...LINE); doc.setLineWidth(0.3); doc.line(M, y - 8, W - M, y - 8);
  const sites = data?.sites || [];
  const siteDepot = sites.find((s) => s.nom === colis.site) || sitesLocaux(sites)[0] || sites[0];
  // Le retrait n'a lieu à une agence Guinée (Bambeto par défaut) que pour les colis livrés en
  // Guinée ; pour un export vers l'étranger, siteRetraitPourColis() renvoie le site déclaré pour
  // ce pays s'il existe, sinon null — le bloc est alors simplement omis plutôt que d'afficher
  // Bambeto à tort.
  const siteRetrait = siteRetraitPourColis(colis, data);
  const bloc = (titre, site, x) => {
    doc.setFont(undefined, "bold"); doc.setFontSize(7.5); doc.setTextColor(...MUTED);
    doc.text(titre.toUpperCase(), x, y);
    doc.setFont(undefined, "bold"); doc.setFontSize(9); doc.setTextColor(...INK);
    doc.text(couper(site?.nom || "—", 80), x, y + 5.5);
    doc.setFont(undefined, "normal"); doc.setFontSize(7.5); doc.setTextColor(...MUTED);
    doc.text(couper(site?.adresse || "", 80), x, y + 10.5);
    doc.text(couper(`${site?.telephone || ""}${site?.horaires ? " · " + site.horaires : ""}`, 80), x, y + 15);
  };
  bloc("Site d'enregistrement", siteDepot, M);
  if (siteRetrait) bloc("Site de retrait", siteRetrait, W / 2 + 2);

  // ── Pied de page ──────────────────────────────────────────────────────────
  doc.setDrawColor(...LINE); doc.line(M, Z.pied - 8, W - M, Z.pied - 8);
  doc.setFont(undefined, "normal"); doc.setFontSize(7); doc.setTextColor(...MUTED);
  doc.text("Conservez ce ticket jusqu'à la remise du colis. Vous serez prévenu par WhatsApp à chaque étape.", M, Z.pied - 3);
  doc.text("BA-DIABY EXPRESS · badiabyexpress.bde@gmail.com", M, Z.pied + 1.5);
  doc.text("Page 1 / 1", W - M, Z.pied + 1.5, { align: "right" });

  if (options.retourner) {
    return { nom: `facture-${colis.tracking}.pdf`, contenu: doc.output("datauristring").split(",")[1] };
  }
  openPdf(doc, `ticket-${colis.tracking}.pdf`);
}

/**
 * Ticket d’envoi au format thermique 80 mm — même contenu que la version A4, mis en page
 * pour une bande continue (largeur fixe, hauteur qui s’adapte au contenu, comme les vrais
 * tickets de caisse). Le QR permet au personnel connecté d’ouvrir le dossier complet du
 * colis dans l’application (suivi, paiements, historique).
 */
async function downloadTicketThermal(colis) {
  const jspdf = await loadJsPDF();
  // colis.pays est le pays de route (l'origine pour un import) ; la devise affichée doit suivre
  // le destinataire réel, toujours la Guinée pour un import.
  const dest = COUNTRIES.find((c) => c.code === (colis.destinatairePays || colis.pays));
  const destCur = dest?.currency || "EUR";
  const statutPaiement = colis.reste <= 0 ? "PAYÉ" : (colis.paye > 0 ? "PAIEMENT PARTIEL" : "NON PAYÉ");
  const statutColor = colis.reste <= 0 ? [30, 140, 80] : (colis.paye > 0 ? [180, 120, 20] : [200, 40, 55]);
  const qrData = await generateQRDataUrl(trackingUrlFor(colis.tracking), 240).catch(() => null);
  const categories = [...new Set((colis.produits || []).map((p) => p.categorie).filter(Boolean))].join(", ") || "—";
  const numeroTicket = `TCK-${colis.tracking}`;
  const articles = (colis.produits || []).reduce((s, p) => s + (Number(p.quantite) || 1), 0) || 1;
  const villeCp = [colis.destinataireCodePostal, colis.destinataireVille].filter(Boolean).join(" ");
  const destPaysNom = COUNTRIES.find((c) => c.code === colis.destinatairePays)?.name || dest?.name;

  const W = 80, M = 4;
  const INK = [20, 22, 26], MUTED = [130, 136, 148], NAVY = [10, 38, 71];

  // Dessine tout le contenu sur un document déjà créé, retourne la position finale atteinte.
  // Appelée deux fois : une première fois sur une page volontairement très haute pour mesurer
  // la hauteur réellement nécessaire, puis une seconde fois sur la page finale, ajustée pile
  // à cette hauteur — exactement comme un vrai ticket de caisse thermique à la longueur variable.
  function draw(doc) {
    let y = 8;
    const center = (text, size, bold, color = INK) => { doc.setFont(undefined, bold ? "bold" : "normal"); doc.setFontSize(size); doc.setTextColor(...color); doc.text(text, W / 2, y, { align: "center" }); };
    const dashed = () => { doc.setLineDashPattern([0.8, 0.8], 0); doc.setDrawColor(...MUTED); doc.setLineWidth(0.2); doc.line(M, y, W - M, y); doc.setLineDashPattern([], 0); };
    // Le libellé est à gauche, la valeur alignée à droite : sur 72 mm utiles, une valeur longue
    // (nom d'agent, référence de transaction…) venait chevaucher le libellé au milieu du ticket.
    // La valeur est donc tronquée à l'espace réellement disponible.
    const rowLR = (label, value, bold = false) => {
      doc.setFont(undefined, "normal"); doc.setFontSize(7.4); doc.setTextColor(...MUTED);
      doc.text(label, M, y);
      const largeurLabel = doc.getTextWidth(label);
      doc.setFont(undefined, bold ? "bold" : "normal"); doc.setFontSize(bold ? 8.6 : 7.6); doc.setTextColor(...INK);
      const dispo = W - 2 * M - largeurLabel - 3;
      let v = String(value ?? "—");
      if (doc.getTextWidth(v) > dispo) {
        while (v.length > 3 && doc.getTextWidth(v + "\u2026") > dispo) v = v.slice(0, -1);
        v += "\u2026";
      }
      doc.text(v, W - M, y, { align: "right" });
      y += bold ? 5.4 : 4.6;
    };
    const sectionTitle = (t) => { doc.setFont(undefined, "bold"); doc.setFontSize(7); doc.setTextColor(...NAVY); doc.text(t.toUpperCase(), M, y); y += 4.6; };

    doc.addImage(DEFAULT_LOGO, "PNG", W / 2 - 8, y - 6, 16, 16);
    y += 13;
    center("BA-DIABY EXPRESS", 11.5, true, NAVY); y += 4.5;
    center("Ticket d’envoi — Reçu client", 7, false, MUTED); y += 5.5;
    dashed(); y += 5;

    center(statutPaiement, 10.5, true, statutColor); y += 6;

    doc.setFont(undefined, "normal"); doc.setFontSize(7); doc.setTextColor(...MUTED);
    rowLR("N° ticket", numeroTicket);
    rowLR("N° de suivi", colis.tracking);
    rowLR("Date", new Date(colis.createdAt).toLocaleString("fr-FR"));
    rowLR("Agent", colis.agentCreation || "—");
    y += 1;
    dashed(); y += 5;

    sectionTitle("Expéditeur");
    doc.setFont(undefined, "bold"); doc.setFontSize(8); doc.setTextColor(...INK);
    doc.text(colis.expediteur || "—", M, y); y += 4;
    doc.setFont(undefined, "normal"); doc.setFontSize(7.2); doc.setTextColor(...MUTED);
    doc.text(colis.expediteurTelephone || "—", M, y); y += 4;
    if (colis.expediteurAdresse) {
      const lines = doc.splitTextToSize(colis.expediteurAdresse, W - 2 * M);
      doc.text(lines, M, y); y += lines.length * 3.6;
    }
    y += 2;
    dashed(); y += 5;

    sectionTitle("Destinataire");
    doc.setFont(undefined, "bold"); doc.setFontSize(8.5); doc.setTextColor(...INK);
    const nomLines = doc.splitTextToSize(colis.destinataire || "—", W - 2 * M);
    doc.text(nomLines, M, y); y += nomLines.length * 4;
    doc.setFont(undefined, "normal"); doc.setFontSize(7.2); doc.setTextColor(...MUTED);
    doc.text(colis.telephone || "—", M, y); y += 3.8;
    if (colis.destinataireEmail) { doc.text(colis.destinataireEmail, M, y); y += 3.8; }
    doc.setTextColor(...INK);
    if (colis.destinataireAdresse) {
      const lines = doc.splitTextToSize(colis.destinataireAdresse, W - 2 * M);
      doc.text(lines, M, y); y += lines.length * 3.6;
    }
    if (villeCp) { doc.text(villeCp, M, y); y += 3.6; }
    if (destPaysNom) { doc.setFont(undefined, "bold"); doc.text(destPaysNom.toUpperCase(), M, y); y += 3.6; }
    y += 2;
    dashed(); y += 5;

    sectionTitle("Informations du colis");
    rowLR("Articles", String(articles));
    rowLR("Poids total", `${colis.poids} kg`);
    rowLR("Catégorie", categories);
    rowLR("Mode", colis.mode === "air" ? "Aérien" : "Maritime");
    rowLR("Route", routeLabel(colis.pays, colis.direction));
    y += 1;
    dashed(); y += 5;

    sectionTitle("Paiement");
    if (colis.discountLoyalty > 0) rowLR("Remise fidélité", `-${colis.discountLoyalty}%`);
    if (colis.rabaisMontant > 0) rowLR("Rabais", `-${colis.rabaisMontant.toLocaleString("fr-FR")} ${colis.rabaisDevise}`);
    rowLR(`Montant total (${destCur})`, fmt(colis.prix, destCur));
    rowLR("Montant total (GNF)", fmt(colis.prix, "GNF"), true);
    rowLR("Montant payé", fmt(colis.paye, "EUR"));
    rowLR("Reste à payer", fmt(colis.reste, "EUR"), colis.reste > 0);
    y += 1;
    dashed(); y += 6;

    if (qrData) {
      const qs = 26;
      doc.addImage(qrData, "PNG", W / 2 - qs / 2, y, qs, qs);
      y += qs + 3;
    }
    center(colis.tracking, 7.5, true, INK); y += 3.5;
    center("À scanner dans l’application pour le dossier complet", 6, false, MUTED); y += 6;
    dashed(); y += 5;

    doc.setFont(undefined, "italic"); doc.setFontSize(7); doc.setTextColor(...INK);
    const merci = doc.splitTextToSize("Merci de votre confiance. Conservez ce ticket jusqu’à la livraison de votre colis.", W - 2 * M);
    doc.text(merci, W / 2, y, { align: "center" }); y += merci.length * 3.6 + 3;
    doc.setFont(undefined, "normal"); doc.setFontSize(6.2); doc.setTextColor(...MUTED);
    const legal = doc.splitTextToSize("Ba-Diaby Express — Conakry, Guinée · badiabyexpress.bde@gmail.com · Transport soumis aux CGV.", W - 2 * M);
    doc.text(legal, W / 2, y, { align: "center" }); y += legal.length * 3;

    return y;
  }

  // Passe 1 : page volontairement très haute, uniquement pour mesurer la hauteur finale nécessaire.
  const measureDoc = preparerDocPdf(new jspdf.jsPDF({ unit: "mm", format: [W, 400] }));
  const finalHeight = Math.ceil(draw(measureDoc) + 6);

  // Passe 2 : page ajustée pile à la bonne hauteur — c’est celle-ci qui est réellement livrée.
  const doc = preparerDocPdf(new jspdf.jsPDF({ unit: "mm", format: [W, finalHeight] }));
  draw(doc);

  openPdf(doc, `ticket-thermique-${colis.tracking}.pdf`);
}

/**
 * Encaissement groupé au comptoir : on choisit un client, on coche ses colis impayés, on saisit
 * la somme remise. Le montant se répartit du colis le plus ancien au plus récent.
 */
/** Déclaration ou résolution d'un litige sur un colis (endommagé ou perdu). */
function LitigeModal({ colis, onDeclarer, onResoudre, onClose }) {
  const ouvert = colis.litige && colis.litige.statut === "Ouvert";
  const [type, setType] = useState(colis.litige?.type || "endommage");
  const [description, setDescription] = useState("");
  const [resolution, setResolution] = useState("");
  const [indemnite, setIndemnite] = useState("");
  const [devise, setDevise] = useState("GNF");
  const taux = LIVE_RATES[devise] || CURRENCIES[devise] || 1;

  return (
    <Modal onClose={onClose} title={ouvert ? "Résoudre le litige" : "Déclarer un litige"} wide>
      {ouvert ? (
        <>
          <div style={{ background: "var(--warn-bg)", border: "1px solid var(--warn-border)", borderRadius: 8, padding: "10px 14px", marginBottom: 16 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--warn-fg)" }}>
              {colis.litige.type === "perdu" ? "Colis perdu" : "Colis endommagé"} — déclaré le {new Date(colis.litige.date).toLocaleDateString("fr-FR")} par {colis.litige.par}
            </div>
            {colis.litige.description && <div style={{ fontSize: 12, color: "var(--text)", marginTop: 4 }}>{colis.litige.description}</div>}
          </div>
          <Field label="Comment le litige a-t-il été réglé ? *">
            <textarea value={resolution} onChange={(e) => setResolution(e.target.value)} rows={3}
              placeholder="Colis remis au client avec un geste commercial, remboursement, remplacement…"
              style={{ ...inputStyle, resize: "vertical" }} />
          </Field>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Field label="Indemnité versée au client (facultatif)">
              <input type="number" step="0.01" min="0" value={indemnite} onChange={(e) => setIndemnite(e.target.value)} placeholder="0" style={{ ...inputStyle, marginBottom: 0 }} />
            </Field>
            <Field label="Devise">
              <select value={devise} onChange={(e) => setDevise(e.target.value)} style={{ ...inputStyle, marginBottom: 0 }}>
                {Object.keys(CURRENCIES).map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </Field>
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>
            L’indemnité apparaîtra en Comptabilité, séparée des dépenses courantes.
          </div>
          <button onClick={() => { onResoudre(resolution.trim(), (Number(indemnite) || 0) / taux); onClose(); }}
            disabled={!resolution.trim()}
            style={{ width: "100%", marginTop: 16, background: resolution.trim() ? "#16A163" : "var(--surface2)",
                     color: resolution.trim() ? "#fff" : "var(--muted)", border: "none", borderRadius: 8,
                     padding: "12px 0", fontSize: 14, fontWeight: 700, cursor: resolution.trim() ? "pointer" : "not-allowed" }}>
            Marquer le litige résolu
          </button>
        </>
      ) : (
        <>
          <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 14 }}>
            Le colis garde son statut de livraison et son historique. Un litige n’efface jamais la vente :
            il la documente, pour que votre comptabilité reste juste.
          </div>
          <Field label="Nature du litige">
            <div style={{ display: "flex", gap: 8 }}>
              {[["endommage", "Colis endommagé"], ["perdu", "Colis perdu"]].map(([k, label]) => (
                <button key={k} onClick={() => setType(k)}
                  style={{ flex: 1, background: type === k ? "var(--warn-bg)" : "var(--surface2)",
                           border: "1.5px solid " + (type === k ? "var(--warn-border)" : "var(--border)"),
                           color: type === k ? "var(--warn-fg)" : "var(--muted)", borderRadius: 8,
                           padding: "10px 0", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  {label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Description (ce que vous avez constaté)">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
              placeholder="Emballage déchiré à l’arrivée, contenu manquant…" style={{ ...inputStyle, resize: "vertical" }} />
          </Field>
          <button onClick={() => { onDeclarer(type, description.trim()); onClose(); }}
            style={{ width: "100%", marginTop: 8, background: "var(--brand-solid)", color: "#fff", border: "none",
                     borderRadius: 8, padding: "12px 0", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
            Déclarer le litige
          </button>
        </>
      )}
    </Modal>
  );
}

/**
 * Preuve de remise, exigée avant de marquer un colis « Livré ».
 *
 * Sans elle, l'application n'enregistrait que la date et l'agent : rien n'indiquait QUI était
 * venu chercher le colis. Le jour où un client affirme n'avoir rien reçu, l'agence n'a rien à
 * opposer — et sur des colis à plusieurs centaines de milliers de francs, c'est le litige le
 * plus coûteux.
 *
 * Le nom est obligatoire ; la pièce d'identité ne l'est pas, car beaucoup de clients ne l'ont
 * pas sur eux et bloquer la remise pour cela paralyserait le comptoir.
 */
function RemiseColisModal({ colis, session, onConfirmer, onClose, onRenvoyerCode }) {
  const [nom, setNom] = useState(colis.destinataire || "");
  const [codeSaisi, setCodeSaisi] = useState("");
  const [sansCode, setSansCode] = useState(false);
  const [renvoye, setRenvoye] = useState(false);
  const codeAttendu = colis.codeRetrait;
  const codeBon = !codeAttendu || sansCode || codeSaisi === codeAttendu;
  const [lienDestinataire, setLien] = useState("lui-meme");
  const [typePiece, setTypePiece] = useState("");
  const [numeroPiece, setNumeroPiece] = useState("");
  const [note, setNote] = useState("");
  const resteDu = Number(colis.reste) || 0;

  const liens = [
    ["lui-meme", "Le destinataire"],
    ["proche", "Un proche"],
    ["mandataire", "Un mandataire"],
  ];

  return (
    <Modal onClose={onClose} title={`Remise du colis ${colis.tracking}`} niveau={1}>
      {resteDu > 0.005 && (
        <div style={{ background: "var(--danger-bg)", border: "1px solid var(--danger-border)", borderRadius: 10, padding: "11px 14px", marginBottom: 16 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--danger-fg)" }}>
            Reste à encaisser : {fmtGNF(resteDu * (LIVE_RATES.GNF || CURRENCIES.GNF))}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--text)", marginTop: 3 }}>
            Pensez à encaisser avant de remettre le colis.
          </div>
        </div>
      )}

      {/*
        Vérification du code de retrait.

        Le code prouve que la personne en face est bien celle qui a reçu le message. L'agent peut
        toutefois passer outre : un client de bonne foi qui a perdu son téléphone ne doit jamais
        repartir sans son colis. Le contournement est alors enregistré avec la remise — c'est une
        décision tracée, pas un trou dans la procédure.
      */}
      {codeAttendu && !sansCode && (
        <div style={{ background: codeSaisi && !codeBon ? "var(--danger-bg)" : "var(--surface2)",
                      border: "1px solid " + (codeSaisi && !codeBon ? "var(--danger-border)" : "var(--border)"),
                      borderRadius: 10, padding: "12px 14px", marginBottom: 16 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>
            Code de retrait à 4 chiffres
          </div>
          <input value={codeSaisi} onChange={(e) => setCodeSaisi(e.target.value.replace(/\D/g, "").slice(0, 4))}
            inputMode="numeric" placeholder="••••" autoFocus
            style={{ ...inputStyle, letterSpacing: 10, fontSize: 20, fontWeight: 700, textAlign: "center", marginBottom: 8 }} />
          {codeSaisi.length === 4 && (
            <div style={{ fontSize: 12, fontWeight: 700, color: codeBon ? "var(--ok-fg)" : "var(--danger-fg)" }}>
              {codeBon ? "\u2713 Code correct" : "Code incorrect"}
            </div>
          )}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8 }}>
            <button type="button" onClick={() => { onRenvoyerCode?.(colis); setRenvoye(true); }}
              style={{ background: "none", border: "none", color: "var(--info-fg)", fontSize: 11.5, fontWeight: 600, cursor: "pointer", padding: 0 }}>
              {renvoye ? "Code renvoyé" : "Renvoyer le code au client"}
            </button>
            <button type="button" onClick={() => setSansCode(true)}
              style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 11.5, cursor: "pointer", padding: 0 }}>
              Le client n’a pas son code
            </button>
          </div>
        </div>
      )}

      {sansCode && (
        <div style={{ background: "var(--warn-bg)", border: "1px solid var(--warn-border)", borderRadius: 10, padding: "11px 14px", marginBottom: 16 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--warn-fg)" }}>Remise sans code</div>
          <div style={{ fontSize: 11.5, color: "var(--text)", marginTop: 3 }}>
            Vérifiez l’identité de la personne. Cette remise sera signalée comme effectuée sans code.
          </div>
          <button type="button" onClick={() => { setSansCode(false); setCodeSaisi(""); }}
            style={{ background: "none", border: "none", color: "var(--info-fg)", fontSize: 11.5, fontWeight: 600, cursor: "pointer", padding: 0, marginTop: 6 }}>
            Finalement, saisir le code
          </button>
        </div>
      )}

      <Field label="Nom de la personne qui récupère *">
        <input value={nom} onChange={(e) => setNom(e.target.value)} style={inputStyle} />
      </Field>

      <Field label="En qualité de">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {liens.map(([k, label]) => (
            <button key={k} type="button" onClick={() => setLien(k)}
              style={{ flex: 1, minWidth: 90, background: lienDestinataire === k ? "var(--info-bg)" : "var(--surface2)",
                       border: "1.5px solid " + (lienDestinataire === k ? "var(--info-border)" : "var(--border)"),
                       color: lienDestinataire === k ? "var(--info-fg)" : "var(--muted)",
                       borderRadius: 8, padding: "9px 6px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
              {label}
            </button>
          ))}
        </div>
      </Field>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Field label="Pièce présentée (facultatif)">
          <select value={typePiece} onChange={(e) => setTypePiece(e.target.value)} style={{ ...inputStyle, marginBottom: 0, width: 175 }}>
            <option value="">Aucune</option>
            <option value="CNI">Carte d’identité</option>
            <option value="Passeport">Passeport</option>
            <option value="Permis">Permis de conduire</option>
            <option value="Carte consulaire">Carte consulaire</option>
            <option value="Autre">Autre</option>
          </select>
        </Field>
        {typePiece && (
          <Field label="Numéro de la pièce">
            <input value={numeroPiece} onChange={(e) => setNumeroPiece(e.target.value)} style={{ ...inputStyle, marginBottom: 0 }} />
          </Field>
        )}
      </div>

      <Field label="Observation (facultatif)">
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Emballage vérifié devant le client…" style={inputStyle} />
      </Field>

      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        Ces informations sont conservées avec le colis et apparaissent sur le bon de sortie.
        Elles vous protègent en cas de contestation.
      </div>

      <button onClick={() => onConfirmer({
          nom: nom.trim(), lien: lienDestinataire, typePiece, numeroPiece: numeroPiece.trim(), note: note.trim(),
          date: new Date().toISOString(),
          agent: `${session.prenom} ${session.nom}`.trim() || session.identifiant,
          codeVerifie: !!codeAttendu && !sansCode,
          sansCode: !!codeAttendu && sansCode,
        })}
        disabled={!nom.trim() || !codeBon}
        style={{ width: "100%", background: nom.trim() && codeBon ? "#16A163" : "var(--surface2)", color: nom.trim() && codeBon ? "#fff" : "var(--muted)",
                 border: "none", borderRadius: 8, padding: "12px 0", fontSize: 14, fontWeight: 700,
                 cursor: nom.trim() && codeBon ? "pointer" : "not-allowed" }}>
        Confirmer la remise
      </button>
    </Modal>
  );
}

function EncaisserGroupeModal({ data, onEncaisser, onClose }) {
  const impayes = (data.colis || []).filter((c) => c.reste > 0.005 && !["Annulé", "Refusé"].includes(c.status));
  const parClient = {};
  impayes.forEach((c) => {
    const cle = c.telephone || c.destinataire;
    if (!parClient[cle]) parClient[cle] = { nom: c.destinataire, telephone: c.telephone, colis: [] };
    parClient[cle].colis.push(c);
  });
  const clients = Object.entries(parClient)
    .map(([cle, v]) => ({ cle, ...v, du: v.colis.reduce((s, c) => s + c.reste, 0) }))
    .filter((c) => c.colis.length > 0)
    .sort((a, b) => b.colis.length - a.colis.length);

  const [clientCle, setClientCle] = useState(clients[0]?.cle || "");
  const [selection, setSelection] = useState([]);
  const [montant, setMontant] = useState("");
  const [devise, setDevise] = useState("GNF");
  const [mode, setMode] = useState("Espèces");

  const client = clients.find((c) => c.cle === clientCle);
  const colisClient = client ? client.colis : [];
  const coches = selection.length ? colisClient.filter((c) => selection.includes(c.tracking)) : colisClient;
  const duSelection = coches.reduce((s, c) => s + c.reste, 0);
  const taux = LIVE_RATES[devise] || CURRENCIES[devise] || 1;
  const montantEUR = (Number(montant) || 0) / taux;

  useEffect(() => { setSelection([]); setMontant(""); }, [clientCle]);

  function basculer(t) {
    setSelection((s) => {
      const base = s.length ? s : colisClient.map((c) => c.tracking);
      return base.includes(t) ? base.filter((x) => x !== t) : [...base, t];
    });
  }

  return (
    <Modal onClose={onClose} title="Règlement groupé — plusieurs colis" wide>
      {clients.length === 0 ? (
        <div style={{ color: "var(--muted)", fontSize: 13.5, padding: "16px 0" }}>Aucun colis impayé pour le moment.</div>
      ) : (
        <>
          <Field label="Client">
            <select value={clientCle} onChange={(e) => setClientCle(e.target.value)} style={inputStyle}>
              {clients.map((c) => (
                <option key={c.cle} value={c.cle}>{c.nom} — {c.colis.length} colis · {fmtGNF(c.du * (LIVE_RATES.GNF || CURRENCIES.GNF))}</option>
              ))}
            </select>
          </Field>

          <div style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 700, margin: "6px 0 8px" }}>
            COLIS À RÉGLER {selection.length === 0 ? `(tous — ${colisClient.length})` : `(${selection.length} sélectionné${selection.length > 1 ? "s" : ""})`}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14, maxHeight: 200, overflowY: "auto" }}>
            {colisClient.map((c) => {
              const actif = coches.some((x) => x.tracking === c.tracking);
              return (
                <button key={c.tracking} onClick={() => basculer(c.tracking)}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10,
                           background: actif ? "var(--info-bg)" : "var(--surface2)",
                           border: "1px solid " + (actif ? "var(--info-border)" : "var(--border)"),
                           borderRadius: 8, padding: "8px 12px", cursor: "pointer", textAlign: "start" }}>
                  <span style={{ fontSize: 12.5, color: "var(--text)", fontWeight: 600 }}>
                    {actif && "\u2713 "}{c.tracking}
                    <span style={{ color: "var(--muted)", fontWeight: 600 }}> · {new Date(c.createdAt).toLocaleDateString("fr-FR")}</span>
                  </span>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--danger-fg)" }}>{fmtGNF(c.reste * (LIVE_RATES.GNF || CURRENCIES.GNF))}</span>
                </button>
              );
            })}
          </div>

          <div style={{ background: "var(--surface2)", borderRadius: 8, padding: "10px 14px", marginBottom: 14, display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12.5, color: "var(--muted)" }}>Total dû sur la sélection</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{fmtGNF(duSelection * (LIVE_RATES.GNF || CURRENCIES.GNF))}</span>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Field label="Montant reçu"><input type="number" step="0.01" min="0" value={montant} onChange={(e) => setMontant(e.target.value)} placeholder="0" autoFocus style={{ ...inputStyle, marginBottom: 0 }} /></Field>
            <Field label="Devise">
              <select value={devise} onChange={(e) => setDevise(e.target.value)} style={{ ...inputStyle, marginBottom: 0 }}>
                {Object.keys(CURRENCIES).map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </Field>
            <Field label="Mode de paiement">
              <select value={mode} onChange={(e) => setMode(e.target.value)} style={{ ...inputStyle, marginBottom: 0 }}>
                {["Espèces", "Orange Money", "MTN Money", "Carte bancaire", "Virement"].map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </Field>
          </div>

          {montantEUR > duSelection + 0.005 && (
            <div style={{ fontSize: 12, color: "var(--warn-fg)", marginTop: 10 }}>
              Le montant dépasse le total dû : seule la somme due sera enregistrée, la différence est de la monnaie à rendre.
            </div>
          )}

          <button
            onClick={() => { onEncaisser(coches.map((c) => c.tracking), montantEUR, mode, Number(montant) || 0, devise); onClose(); }}
            disabled={!(montantEUR > 0)}
            style={{ width: "100%", marginTop: 16, background: montantEUR > 0 ? "var(--brand-solid)" : "var(--surface2)",
                     color: montantEUR > 0 ? "#fff" : "var(--muted)", border: "none", borderRadius: 8,
                     padding: "12px 0", fontSize: 14, fontWeight: 700, cursor: montantEUR > 0 ? "pointer" : "not-allowed" }}>
            Encaisser sur {coches.length} colis
          </button>
        </>
      )}
    </Modal>
  );
}

function EditColisForm({ colis, onClose, onSave, tarifsReception, remiseVolumeConfig, categories }) {
  const [expediteur, setExpediteur] = useState(colis.expediteur);
  const [destinataire, setDestinataire] = useState(colis.destinataire);
  const [telephone, setTelephone] = useState(colis.telephone);
  const [pays, setPays] = useState(colis.pays);
  const [direction, setDirection] = useState(colis.direction || "export");
  const [mode, setMode] = useState(colis.mode);
  const [poids, setPoids] = useState(String(colis.poids));
  const [volume, setVolume] = useState(String(colis.volume || ""));
  const [paye, setPaye] = useState(String(colis.paye || ""));
  const [rabaisMontant, setRabaisMontant] = useState(String(colis.rabaisMontant || 0));
  const [rabaisDevise, setRabaisDevise] = useState(colis.rabaisDevise || "GNF");
  const [err, setErr] = useState("");
  /*
   * Deux barèmes coexistent : le barème export (par pays et mode de transport) et les paliers
   * de réception utilisés pour les colis annoncés depuis l'Espace Client. On applique celui
   * avec lequel le colis a été créé — auparavant la modification appliquait toujours le barème
   * export, ce qui écrasait le prix d'un colis de l'Espace Client dès qu'on ouvrait la fiche
   * pour corriger un simple numéro de téléphone.
   */
  /*
   * Trois barèmes coexistent, et la modification doit reprendre CELUI qui a servi à créer le colis :
   *   - paliers de réception, pour les colis annoncés depuis l'Espace Client ;
   *   - somme des produits selon leur catégorie, cas le plus courant ;
   *   - barème export par pays et mode, quand le colis n'a pas de produit tarifé.
   *
   * Auparavant la modification appliquait toujours le barème export : ouvrir la fiche d'un colis
   * « Bateau » et enregistrer sans rien changer faisait passer son prix de 26,32 à 125,00 EUR,
   * silencieusement. Le prix facturé au client était multiplié par 4,75.
   */
  const auxPaliers = colis.tarification === "reception";
  const valeurProduits = (colis.produits || []).reduce((somme, prod) => somme + produitValeurGNF(prod, categories || []), 0);
  const prixBrut = auxPaliers
    ? +(calcReceptionFee(Number(poids) || 0, tarifsReception).total / (LIVE_RATES.GNF || CURRENCIES.GNF)).toFixed(2)
    : valeurProduits > 0
      ? +(valeurProduits / (LIVE_RATES.GNF || CURRENCIES.GNF)).toFixed(2)
      : calcPrice(pays, poids, volume, mode);
  const discountLoyalty = colis.discountLoyalty || 0;
  const discountVolume = remiseVolumePourcent(poids, remiseVolumeConfig);
  const prixApresFidelite = +(prixBrut * (1 - discountLoyalty / 100) * (1 - discountVolume / 100)).toFixed(2);
  const rabaisEUR = +((Number(rabaisMontant) || 0) / (LIVE_RATES[rabaisDevise] || CURRENCIES[rabaisDevise] || 1)).toFixed(2);
  const prix = Math.max(+(prixApresFidelite - rabaisEUR).toFixed(2), 0);
  const payeNum = Number(paye) || 0;
  const reste = Math.max(prix - payeNum, 0);

  function submit(e) {
    e.preventDefault();
    if (!expediteur || !destinataire || !telephone) return;
    // Un colis de 0 kg n'existe pas : on refuse l'enregistrement plutôt que de créer une
    // ligne qui faussera ensuite les totaux de poids, le chiffre d'affaires et les commissions.
    if (!(Number(poids) > 0)) { setErr("Le poids doit être supérieur à 0 kg."); return; }
    onSave({
      expediteur, destinataire, telephone, pays, direction,
      destinatairePays: direction === "import" ? "GN" : pays, mode,
      poids: Number(poids) || 0, volume: Number(volume) || 0,
      prixBrut, discountLoyalty, rabaisMontant: Number(rabaisMontant) || 0, rabaisDevise, rabaisEUR, prix, paye: payeNum, reste,
    });
  }

  return (
    <Modal onClose={onClose} title={`Modifier le colis ${colis.tracking}`} wide saisieEnCours={poids !== String(colis.poids) || destinataire !== colis.destinataire}>
      <form onSubmit={submit} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
        <Field label="Expéditeur"><input value={expediteur} onChange={(e) => setExpediteur(e.target.value)} style={inputStyle} /></Field>
        <Field label="Destinataire"><input value={destinataire} onChange={(e) => setDestinataire(e.target.value)} style={inputStyle} /></Field>
        <Field label="Téléphone (WhatsApp)"><PhoneInput value={telephone} onChange={setTelephone} /></Field>
        <Field label="Destination"><select value={pays} onChange={(e) => setPays(e.target.value)} style={inputStyle}>{COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name} — {c.city}</option>)}</select></Field>
        <div style={{ gridColumn: "1 / -1" }}>
          <Field label="Sens de la route">
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={() => setDirection("export")} style={{ ...toggleBtn, ...(direction === "export" ? toggleActive : {}) }}>Conakry → {COUNTRIES.find(c=>c.code===pays)?.city}</button>
              <button type="button" onClick={() => setDirection("import")} style={{ ...toggleBtn, ...(direction === "import" ? toggleActive : {}) }}>{COUNTRIES.find(c=>c.code===pays)?.city} → Conakry</button>
            </div>
          </Field>
        </div>
        <Field label="Poids (kg)"><input value={poids} onChange={(e) => setPoids(e.target.value)} style={inputStyle} /></Field>
        <Field label="Volume (m³, optionnel)"><input value={volume} onChange={(e) => setVolume(e.target.value)} style={inputStyle} /></Field>
        <Field label="Mode de transport">
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={() => setMode("air")} style={{ ...toggleBtn, ...(mode === "air" ? toggleActive : {}) }}><Plane size={14} /> Aérien</button>
            <button type="button" disabled title="Voie maritime temporairement indisponible" style={{ ...toggleBtn, opacity: 0.4, cursor: "not-allowed" }}><Ship size={14} /> Maritime</button>
          </div>
        </Field>
        <Field label="Montant du rabais"><input value={rabaisMontant} onChange={(e) => setRabaisMontant(e.target.value)} style={inputStyle} /></Field>
        <Field label="Devise du rabais">
          <select value={rabaisDevise} onChange={(e) => setRabaisDevise(e.target.value)} style={inputStyle}>
            {Object.keys(CURRENCIES).map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Montant payé (EUR)"><input value={paye} onChange={(e) => setPaye(e.target.value)} style={inputStyle} /></Field>
        {err && <div style={{ gridColumn: "1 / -1", color: "var(--danger-fg)", fontSize: 12.5 }}>{err}</div>}
        <div style={{ gridColumn: "1 / -1", background: "var(--surface2)", borderRadius: 12, padding: "12px 16px", display: "flex", justifyContent: "space-between" }}>
          <div style={{ fontSize: 13, color: "var(--text)" }}>Total recalculé : <strong>{fmt(prix, "EUR")}</strong></div>
          <div style={{ fontSize: 13, color: reste > 0 ? "var(--danger-fg)" : "var(--ok-fg)" }}>Reste à payer : <strong>{fmt(reste, "EUR")}</strong></div>
        </div>
        <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
          <button type="button" onClick={onClose} style={{ padding: "10px 18px", borderRadius: 8, border: "1.5px solid var(--border)", background: "var(--surface)", color: "var(--muted)", fontSize: 13.5, cursor: "pointer" }}>Annuler</button>
          <button type="submit" style={{ padding: "10px 18px", borderRadius: 8, border: "none", background: "var(--brand-solid)", color: "#fff", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>Enregistrer les modifications</button>
        </div>
      </form>
    </Modal>
  );
}

function ColisDetail({ colis, onClose, onAdvance, onDelete, onCancel, onRefuser, onDeclarerLitige, onResoudreLitige, onMajRetour, onUpdate, onEncaisser, canManage, isAdmin, isChauffeur, data, session, notify }) {
  const [cancelling, setCancelling] = useState(false);
  const [refusing, setRefusing] = useState(false);
  const [motifRefus, setMotifRefus] = useState("");
  const [motif, setMotif] = useState("");
  const [editing, setEditing] = useState(false);
  const [showLitige, setShowLitige] = useState(false);
  const [confirmerSuppression, setConfirmerSuppression] = useState(false);
  const [emplacement, setEmplacement] = useState(colis.emplacement || "");
  const [waState, setWaState] = useState("");
  const [waErreur, setWaErreur] = useState("");

  /*
   * Notification WhatsApp : on tente l'envoi automatique via Twilio, et si ce n'est pas possible
   * (Twilio non configuré, hors ligne, fenêtre de 24 h dépassée) on ouvre le brouillon WhatsApp
   * comme avant. L'agent n'est jamais bloqué : dans le pire des cas il appuie sur Envoyer.
   */
  async function notifierWhatsApp() {
    const message = `Bonjour ${colis.destinataire}, votre colis Ba-Diaby Express (${colis.tracking}) est actuellement : ${clientStatusLabel(colis.status)}. Suivez-le à tout moment sur notre plateforme.`;
    setWaErreur(""); setWaState("envoi");
    const { envoye, raison } = await envoyerWhatsApp(colis.telephone, message);
    if (envoye) { setWaState("envoye"); return; }
    if (raison) setWaErreur(raison);
    setWaState("brouillon");
    window.open(waLink(colis.telephone, message), "_blank", "noreferrer");
  }
  const [payerOuvert, setPayerOuvert] = useState(false);
  const [montantPaye, setMontantPaye] = useState(String(colis.reste || ""));
  const [devisePaiement, setDevisePaiement] = useState("EUR");
  const [modePaiement, setModePaiement] = useState("Espèces");
  const [referenceTransaction, setReferenceTransaction] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [reponses, setReponses] = useState({});
  const [numeroPayeur, setNumeroPayeur] = useState(colis.telephone || "");
  const [numeroReceveur, setNumeroReceveur] = useState("");
  const [recuState, setRecuState] = useState("idle");
  const [bonSortieOuvert, setBonSortieOuvert] = useState(false);
  const [recupNom, setRecupNom] = useState(colis.destinataire || "");
  const [recupTel, setRecupTel] = useState(colis.telephone || "");
  const [recupPiece, setRecupPiece] = useState("");
  const [recupDate, setRecupDate] = useState(new Date().toISOString().slice(0, 10));
  const [bonSortieState, setBonSortieState] = useState("idle");
  const isLast = STATUSES.indexOf(colis.status) === STATUSES.length - 1;
  const [loc, setLoc] = useState(colis.driverLoc);
  const sigRef = useRef(null);
  const [drawing, setDrawing] = useState(false);
  const [labelState, setLabelState] = useState("idle");
  const [invoiceState, setInvoiceState] = useState("idle");
  const [ticketThermalState, setTicketThermalState] = useState("idle");

  async function handleDownloadLabel() {
    setLabelState("loading");
    try { await downloadLabel(colis); setLabelState("idle"); }
    catch (e) { console.error(e); setLabelState("error"); }
  }
  async function handleDownloadInvoice() {
    setInvoiceState("loading");
    try { await downloadInvoice(colis, data); setInvoiceState("idle"); }
    catch (e) { console.error(e); setInvoiceState("error"); }
  }
  const [emailState, setEmailState] = useState("idle");

  /**
   * Envoie la facture par e-mail au client.
   *
   * Le bouton n'apparaît que si une adresse est renseignée — inutile de proposer une action
   * impossible. Si le service n'est pas configuré, on ouvre un brouillon : l'agent reste
   * maître de l'envoi plutôt que de rester bloqué.
   */
  async function handleEnvoyerFacture() {
    const adresse = colis.destinataireEmail || colis.email;
    if (!adresse) return;
    setEmailState("loading");
    try {
      const piece = await downloadInvoice(colis, data, { retourner: true });
      const { envoye, raison } = await envoyerEmail(
        adresse,
        `Votre facture Ba-Diaby Express — ${colis.tracking}`,
        `<p>Bonjour ${colis.destinataire},</p>
         <p>Vous trouverez ci-joint la facture de votre colis <strong>${colis.tracking}</strong>.</p>
         <p style="color:#888;font-size:12px">Ba-Diaby Express — Transport de colis Conakry - Monde</p>`,
        piece ? [piece] : []
      );
      if (envoye) { setEmailState("envoye"); return; }
      if (raison) notify?.(raison);
      // Repli : brouillon dans le logiciel de messagerie de l'agent.
      window.open(`mailto:${adresse}?subject=${encodeURIComponent(`Votre facture Ba-Diaby Express — ${colis.tracking}`)}&body=${encodeURIComponent(`Bonjour ${colis.destinataire},\n\nVeuillez trouver la facture de votre colis ${colis.tracking}.\n\nBa-Diaby Express`)}`, "_blank");
      setEmailState("brouillon");
    } catch (e) {
      console.error(e);
      setEmailState("error");
    }
  }

  async function handleDownloadTicketThermal() {
    setTicketThermalState("loading");
    try { await downloadTicketThermal(colis); setTicketThermalState("idle"); }
    catch (e) { console.error(e); setTicketThermalState("error"); }
  }
  async function handleDownloadRecu(paiement) {
    setRecuState(paiement.id);
    try { await downloadRecu(colis, paiement); setRecuState("idle"); }
    catch (e) { console.error(e); setRecuState("error"); }
  }
  function validerEncaissement() {
    const n = Number(String(montantPaye).replace(",", "."));
    if (isNaN(n) || n <= 0) return;
    // convertit le montant saisi (dans devisePaiement) vers l’équivalent EUR, notre unité de référence interne
    const montantEUR = +(n / (LIVE_RATES[devisePaiement] || CURRENCIES[devisePaiement] || 1)).toFixed(2);
    onEncaisser(montantEUR, modePaiement, n, devisePaiement, { reference: referenceTransaction, numeroPayeur, numeroReceveur });
    setPayerOuvert(false);
    setMontantPaye(""); setReferenceTransaction("");
  }
  function validerBonSortie() {
    if (!recupNom.trim() || !recupTel.trim()) return;
    onUpdate({ bonSortie: { nom: recupNom, telephone: recupTel, piece: recupPiece, date: recupDate, enregistrePar: `${session?.prenom || ""} ${session?.nom || ""}`.trim(), creeLe: new Date().toISOString() } });
    setBonSortieOuvert(false);
  }
  async function telechargerBonSortie() {
    setBonSortieState("loading");
    try { await downloadBonSortie(colis); setBonSortieState("idle"); }
    catch (e) { console.error(e); setBonSortieState("error"); }
  }

  function locate() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      const l = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setLoc(l); onUpdate({ driverLoc: l });
    }, () => {});
  }
  function startDraw(e) { setDrawing(true); draw(e); }
  function draw(e) {
    if (!drawing && e.type !== "mousedown" && e.type !== "touchstart") return;
    const canvas = sigRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#0A2647"; ctx.beginPath(); ctx.arc(x, y, 1.5, 0, 7); ctx.fill();
  }
  function endDraw() {
    setDrawing(false);
    const canvas = sigRef.current;
    if (canvas) onUpdate({ signature: canvas.toDataURL() });
  }
  function capturePhoto(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas");
        const scale = Math.min(1, 500 / img.width);
        c.width = img.width * scale; c.height = img.height * scale;
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        onUpdate({ pod: c.toDataURL("image/jpeg", 0.6) });
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  const destCurrency = COUNTRIES.find((c) => c.code === colis.pays)?.currency || "EUR";
  const expCurrency = COUNTRIES.find((c) => c.code === (colis.expediteurPays || "GN"))?.currency || "GNF";
  const destCliCurrency = COUNTRIES.find((c) => c.code === (colis.destinatairePays || colis.pays))?.currency || destCurrency;
  const devisesAffichees = [...new Set(["GNF", expCurrency, destCliCurrency])];
  const statutPaiement = colis.reste <= 0 ? "Payé" : colis.paye > 0 ? "Partiellement payé" : "Non payé";
  // Deux teintes distinctes : une pastille pleine (texte blanc dessus) et une couleur de
  // texte adaptée au thème — la même valeur ne peut pas servir aux deux sans perdre en lisibilité.
  const statutBg = colis.reste <= 0 ? "#0F7A45" : colis.paye > 0 ? "#8A6008" : "var(--brand-solid)";
  const statutFg = colis.reste <= 0 ? "var(--ok-fg)" : colis.paye > 0 ? "var(--warn-fg)" : "var(--danger-fg)";

  return (
    <Modal onClose={onClose} title="Détail du colis" wide>
      {colis.demandeExpress && (
        <div style={{ background: "var(--warn-bg)", border: "1px solid var(--warn-border)", borderRadius: 12, padding: "12px 16px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div style={{ fontSize: 12.5, color: "var(--warn-fg)" }}>⚡ Livraison express demandée par le client — {fmt(colis.demandeExpress.montant, "EUR")} · statut : <strong>{colis.demandeExpress.statut}</strong></div>
          {canManage && colis.demandeExpress.statut === "En attente" && (
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => onUpdate((() => { const m = Number(colis.demandeExpress?.montant) || 0; const deja = !!colis.demandeExpress?.facture; const ajout = m && !deja ? m : 0; const retrait = 0; const prix = Math.max(+((colis.prix || 0) + ajout - retrait).toFixed(2), 0); return { prix, reste: Math.max(+(prix - (colis.paye || 0)).toFixed(2), 0), demandeExpress: { ...colis.demandeExpress, statut: "Confirmée", dateDecision: new Date().toISOString(), traitePar: `${session.prenom} ${session.nom}`.trim(), facture: true } }; })())} style={{ background: "#3ECB84", color: "#0A2647", border: "none", borderRadius: 6, padding: "5px 12px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>Confirmer</button>
              <button onClick={() => onUpdate((() => { const m = Number(colis.demandeExpress?.montant) || 0; const deja = !!colis.demandeExpress?.facture; const ajout = 0; const retrait = deja ? m : 0; const prix = Math.max(+((colis.prix || 0) + ajout - retrait).toFixed(2), 0); return { prix, reste: Math.max(+(prix - (colis.paye || 0)).toFixed(2), 0), demandeExpress: { ...colis.demandeExpress, statut: "Refusée", dateDecision: new Date().toISOString(), traitePar: `${session.prenom} ${session.nom}`.trim(), facture: false } }; })())} style={{ background: "none", border: "1px solid var(--warn-border)", color: "var(--warn-fg)", borderRadius: 6, padding: "5px 12px", fontSize: 11.5, cursor: "pointer" }}>Refuser</button>
            </div>
          )}
        </div>
      )}
      {(colis.declarationsPaiement || []).filter((d) => d.statut === "En attente").map((d) => (
        <div key={d.id} style={{ background: "var(--info-bg-alt)", border: "1px solid var(--info-border)", borderRadius: 12, padding: "12px 16px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div style={{ fontSize: 12.5, color: "var(--info-fg)" }}>
            💳 Le client déclare avoir payé <strong>{d.montant.toLocaleString("fr-FR")} {d.devise}</strong> par {d.mode} — réf. <strong>{d.reference}</strong>. Vérifiez la transaction sur votre téléphone avant de confirmer.
          </div>
          {canManage && (
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => {
                const montantEUR = +(d.montant / (LIVE_RATES[d.devise] || CURRENCIES[d.devise] || 1)).toFixed(2);
                onEncaisser(montantEUR, d.mode, d.montant, d.devise, { reference: d.reference }, d.id);
              }} style={{ background: "#3ECB84", color: "#0A2647", border: "none", borderRadius: 6, padding: "5px 12px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>Vérifié — confirmer</button>
              <button onClick={() => onUpdate({ declarationsPaiement: (colis.declarationsPaiement || []).map((x) => (x.id === d.id ? { ...x, statut: "Rejeté" } : x)) })} style={{ background: "none", border: "1px solid var(--info-border)", color: "var(--info-fg)", borderRadius: 6, padding: "5px 12px", fontSize: 11.5, cursor: "pointer" }}>Rejeter</button>
            </div>
          )}
        </div>
      ))}
      {(colis.signalements || []).map((s) => (
        <div key={s.id} style={{ background: s.statut === "Ouvert" ? "var(--warn-bg)" : "var(--surface2)", border: "1px solid " + (s.statut === "Ouvert" ? "var(--warn-border)" : "var(--border)"), borderRadius: 12, padding: "12px 16px", marginBottom: 16 }}>
          <div style={{ fontSize: 12.5, color: s.statut === "Ouvert" ? "var(--warn-fg)" : "var(--text)", marginBottom: s.statut === "Ouvert" && canManage ? 10 : 0 }}>
            ⚠️ <strong>Problème signalé par le client</strong> ({new Date(s.dateCreation).toLocaleDateString("fr-FR")}) : {s.message}
            {s.reponse && <div style={{ marginTop: 6, color: "var(--muted)" }}>Réponse envoyée : {s.reponse}</div>}
          </div>
          {canManage && s.statut === "Ouvert" && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input value={reponses[s.id] || ""} onChange={(e) => setReponses((r) => ({ ...r, [s.id]: e.target.value }))} placeholder="Votre réponse au client..." style={{ ...inputStyle, flex: 1, minWidth: 180, marginBottom: 0 }} />
              <button onClick={() => {
                const rep = (reponses[s.id] || "").trim();
                onUpdate({ signalements: (colis.signalements || []).map((x) => (x.id === s.id ? { ...x, statut: "Résolu", reponse: rep || "Résolu par l’agence.", dateReponse: new Date().toISOString() } : x)) });
              }} style={{ background: "#3ECB84", color: "#0A2647", border: "none", borderRadius: 6, padding: "0 14px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>Répondre & clore</button>
            </div>
          )}
        </div>
      ))}
      <div style={{ background: "#0A2647", borderRadius: 14, padding: "20px 22px", color: "#fff", marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div><div style={{ fontSize: 11, color: "var(--muted)" }}>N° DE SUIVI</div><div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 22, fontWeight: 700 }}>{colis.tracking}</div>{colis.provenance && <span style={{ display: "inline-block", marginTop: 4, background: "rgba(255,255,255,0.12)", borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>{colis.provenance}</span>}</div>
          <div style={{ textAlign: "right" }}><div style={{ fontSize: 11, color: "var(--muted)" }}>ROUTE</div><div style={{ fontSize: 15, fontWeight: 700 }}>{routeLabel(colis.pays, colis.direction)}</div></div>
        </div>
        <div style={{ borderTop: "1.5px dashed rgba(255,255,255,0.3)", margin: "16px 0" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14 }}>
          <QRCodeImg value={colis.tracking} size={70} />
          <Barcode value={colis.tracking} />
          <span style={{ fontSize: 10.5, color: "var(--muted)" }}>{colis.mode === "air" ? "AÉRIEN" : "MARITIME"}</span>
        </div>
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 16, marginBottom: 18 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 12 }}>Expéditeur &amp; Destinataire</div>
        <div style={{ display: "flex", gap: 12, paddingLeft: 12, borderLeft: "3px solid #5B8DEF", marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 10.5, color: "var(--info-fg)", fontWeight: 700, textTransform: "uppercase" }}>Expéditeur · {COUNTRIES.find((c) => c.code === (colis.expediteurPays || "GN"))?.name || "Guinée"}</div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)", marginTop: 2 }}>{colis.expediteur}</div>
            <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{colis.expediteurTelephone || "—"}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, paddingLeft: 12, borderLeft: "3px solid #3ECB84" }}>
          <div>
            <div style={{ fontSize: 10.5, color: "var(--ok-fg)", fontWeight: 700, textTransform: "uppercase" }}>Destinataire · {COUNTRIES.find((c) => c.code === (colis.destinatairePays || colis.pays))?.name || destCurrency}</div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)", marginTop: 2 }}>{colis.destinataire}</div>
            <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{colis.telephone || "—"}</div>
            {colis.destinataireAdresse && <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>{colis.destinataireAdresse}{colis.destinataireVille ? `, ${colis.destinataireVille}` : ""}{colis.destinataireCodePostal ? ` ${colis.destinataireCodePostal}` : ""}</div>}
          </div>
        </div>
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 16, marginBottom: 18 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 12 }}>Détails généraux</div>
        {[
          ["Poids / Volume", `${colis.poids} kg${colis.volume ? ` · ${colis.volume} m³` : ""}`],
          ["Valeur déclarée", colis.valeurDeclaree > 0 ? `${fmtGNF(colis.valeurDeclaree)}  ~ ${fmt(colis.valeurDeclaree / (LIVE_RATES.GNF || 9500), "EUR")}` : "Non déclarée"],
          ["Prix total", `${fmt(colis.prix, "GNF")}  ~ ${fmt(colis.prix, "EUR")}`],
        ].map(([label, value]) => (
          <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderTop: "1px solid var(--border)" }}>
            <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{label}</span>
            <span style={{ fontSize: 12.5, color: "var(--text)", fontWeight: 600, textAlign: "right" }}>{value}</span>
          </div>
        ))}
        {(colis.discountLoyalty > 0 || colis.rabaisMontant > 0) && (
          <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderTop: "1px solid var(--border)" }}>
            <span style={{ fontSize: 12.5, color: "var(--muted)" }}>Remise appliquée</span>
            <span style={{ fontSize: 12.5, color: "var(--ok-fg)", fontWeight: 600, textAlign: "right" }}>{colis.discountLoyalty > 0 ? `fidélité -${colis.discountLoyalty}%` : ""}{colis.discountLoyalty > 0 && colis.rabaisMontant > 0 ? " + " : ""}{colis.rabaisMontant > 0 ? `rabais ${colis.rabaisMontant.toLocaleString("fr-FR")} ${colis.rabaisDevise}` : ""}</span>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderTop: "1px solid var(--border)" }}>
          <span style={{ fontSize: 12.5, color: "var(--muted)" }}>Suivi public</span>
          <div style={{ display: "flex", gap: 12 }}>
            <button onClick={() => {
              const url = new URL(window.location.href);
              url.search = ""; url.searchParams.set("suivi", "1"); url.searchParams.set("code", colis.tracking);
              navigator.clipboard?.writeText(url.toString());
            }} style={{ background: "none", border: "none", color: "var(--info-fg)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>Copier le lien</button>
            <button onClick={() => {
              const url = new URL(window.location.href);
              url.search = ""; url.searchParams.set("suivi", "1"); url.searchParams.set("code", colis.tracking);
              window.open(url.toString(), "_blank");
            }} style={{ background: "none", border: "none", color: "var(--info-fg)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>Ouvrir</button>
          </div>
        </div>
      </div>

      <div style={{ background: "var(--surface)", border: `1.5px solid ${statutFg}`, borderRadius: 12, padding: 16, marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>Paiements</div>
          <span style={{ background: statutBg, color: "#fff", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{statutPaiement}</span>
        </div>
        {colis.reste > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>RESTE À PAYER — TOUJOURS RECALCULÉ SELON LE TAUX DU JOUR</div>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              {devisesAffichees.map((cur) => (
                <div key={cur} style={{ fontSize: 18, fontWeight: 700, color: statutFg, fontFamily: "'Space Grotesk',sans-serif" }}>{fmt(colis.reste, cur)}</div>
              ))}
            </div>
          </div>
        )}
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>Payé : {fmt(colis.paye, "EUR")} sur {fmt(colis.prix, "EUR")}</div>

        {colis.reste > 0 && effectivePermission(session, "colis.enregistrer_paiement") && (
          payerOuvert ? (
            <div style={{ background: "var(--surface2)", borderRadius: 12, padding: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, marginBottom: 6 }}>
                <Field label="Montant reçu">
                  <input value={montantPaye} onChange={(e) => setMontantPaye(e.target.value)} style={inputStyle} />
                </Field>
                <Field label="Devise du paiement">
                  <select value={devisePaiement} onChange={(e) => { setDevisePaiement(e.target.value); setMontantPaye(String(fmtRaw(colis.reste, e.target.value))); }} style={inputStyle}>
                    {devisesAffichees.map((cur) => <option key={cur} value={cur}>{cur}</option>)}
                  </select>
                </Field>
              </div>
              <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 10 }}>
                Reste à payer dans cette devise : {fmt(colis.reste, devisePaiement)} — équivalent au taux du jour.
              </div>
              <Field label="Mode de paiement">
                <select value={modePaiement} onChange={(e) => {
                  setModePaiement(e.target.value);
                  const cfg = data?.paymentConfig || {};
                  if (e.target.value === "Orange Money") setNumeroReceveur(cfg.orangeMoney || "");
                  else if (e.target.value === "MTN Money") setNumeroReceveur(cfg.mtnMoney || "");
                  else setNumeroReceveur("");
                }} style={inputStyle}>
                  {["Espèces", "Orange Money", "MTN Money", "Carte bancaire", "Virement"].map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </Field>
              {(modePaiement === "Orange Money" || modePaiement === "MTN Money" || modePaiement === "Virement") && (
                <div style={{ background: "var(--surface)", borderRadius: 8, padding: 12, marginTop: 8 }}>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8 }}>DÉTAILS DE LA TRANSACTION (optionnel mais recommandé)</div>
                  <Field label="Référence de la transaction"><input value={referenceTransaction} onChange={(e) => setReferenceTransaction(e.target.value)} style={inputStyle} placeholder="ex: MP240726.1234.A56789" /></Field>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
                    <Field label="Numéro qui a payé"><input value={numeroPayeur} onChange={(e) => setNumeroPayeur(e.target.value)} style={inputStyle} /></Field>
                    <Field label="Numéro qui a reçu"><input value={numeroReceveur} onChange={(e) => setNumeroReceveur(e.target.value)} style={inputStyle} /></Field>
                  </div>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
                <button onClick={() => setPayerOuvert(false)} style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 12.5, cursor: "pointer" }}>Annuler</button>
                <button onClick={validerEncaissement} style={{ background: "#3ECB84", color: "#0A2647", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>Valider l’encaissement</button>
              </div>
            </div>
          ) : (
            <button onClick={() => { setDevisePaiement("EUR"); setMontantPaye(String(colis.reste)); setPayerOuvert(true); }} style={{ width: "100%", background: "#3ECB84", color: "#0A2647", border: "none", borderRadius: 8, padding: "10px 0", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Encaisser</button>
          )
        )}

        {colis.paiements && colis.paiements.length > 0 && (
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
            <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8 }}>HISTORIQUE DES PAIEMENTS</div>
            {colis.paiements.map((p) => (
              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", fontSize: 12, color: "var(--text)", marginBottom: 8 }}>
                <div>
                  <div>{p.deviseSaisie ? fmt(p.montant, p.deviseSaisie) : fmt(p.montant, "EUR")}{p.deviseSaisie && p.deviseSaisie !== "EUR" ? ` (≈ ${fmt(p.montant, "EUR")})` : ""} · {p.mode}</div>
                  {p.reference && <div style={{ fontSize: 10.5, color: "var(--muted)" }}>Réf. {p.reference}{p.numeroPayeur ? ` · payeur ${p.numeroPayeur}` : ""}{p.numeroReceveur ? ` · reçu sur ${p.numeroReceveur}` : ""}</div>}
                  <div style={{ fontSize: 10.5, color: "var(--muted)" }}>{new Date(p.date).toLocaleDateString("fr-FR")}{p.par ? ` · ${p.par}` : ""}</div>
                </div>
                <button onClick={() => handleDownloadRecu(p)} disabled={recuState === p.id} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 8px", color: "var(--muted)", cursor: "pointer", fontSize: 10.5, display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                  <Download size={11} /> {recuState === p.id ? "…" : "Reçu"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 16, marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: (colis.remise || colis.bonSortie) ? 10 : 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>Bon de sortie</div>
          {!colis.remise && !colis.bonSortie && canManage && <button onClick={() => setBonSortieOuvert(true)} style={{ background: "#3D63FF", color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Enregistrer la remise</button>}
        </div>
        {(colis.remise || colis.bonSortie) && (
          <div>
            <div style={{ fontSize: 12, color: "var(--text)" }}>Récupéré par <strong>{(colis.remise || colis.bonSortie).nom}</strong>{colis.bonSortie?.telephone ? ` · ${colis.bonSortie.telephone}` : ""}</div>
            {(colis.bonSortie?.piece || colis.remise?.typePiece) && <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>Pièce d’identité : {colis.bonSortie?.piece || `${colis.remise.typePiece}${colis.remise.numeroPiece ? " " + colis.remise.numeroPiece : ""}`}</div>}
            <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>Le {new Date((colis.remise || colis.bonSortie).date).toLocaleDateString("fr-FR")} · enregistré par {(colis.remise || colis.bonSortie).enregistrePar || (colis.remise || colis.bonSortie).agent}</div>
            <button onClick={telechargerBonSortie} disabled={bonSortieState === "loading"} style={{ ...smallBtn, marginTop: 10 }}><Download size={13} /> {bonSortieState === "loading" ? "Génération…" : "Télécharger le bon de sortie"}</button>
            {bonSortieState === "error" && <span style={{ fontSize: 11, color: "var(--danger-fg)", marginLeft: 8 }}>Échec — réessayez</span>}
          </div>
        )}
        {!colis.bonSortie && <div style={{ fontSize: 12, color: "var(--muted)" }}>Aucune remise enregistrée pour ce colis.</div>}
      </div>

      {colis.photos && colis.photos.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text)", marginBottom: 10 }}>Photos du colis</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(96px,1fr))", gap: 10 }}>
            {colis.photos.map((src, i) => (
              <img key={i} src={src} alt={`Photo ${i + 1}`} style={{ width: "100%", height: 96, objectFit: "cover", borderRadius: 8, border: "1.5px solid var(--border)" }} />
            ))}
          </div>
        </div>
      )}

      {/*
        Emplacement physique du colis.

        Savoir qu'un colis est « à Bambeto » ne dit pas sur quelle étagère. Avec plusieurs
        centaines de colis en attente, l'agent fouille à chaque client. Le champ est libre :
        chaque agence a sa façon de ranger (A3, étagère 2, palette 7…), lui imposer un format
        serait la meilleure façon qu'il ne soit jamais rempli.
      */}
      {["Arrivé", "Disponible au retrait"].includes(colis.status) && !colis.remise && canManage && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 14px", marginBottom: 18 }}>
          <MapPin size={14} color="var(--muted)" />
          <span style={{ fontSize: 12.5, color: "var(--muted)", flexShrink: 0 }}>Emplacement</span>
          <input
            defaultValue={colis.emplacement || ""}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v !== (colis.emplacement || "")) onUpdate({ emplacement: v });
            }}
            placeholder="A3, étagère 2, palette 7…"
            style={{ ...inputStyle, marginBottom: 0, flex: 1, minWidth: 140 }} />
        </div>
      )}

      {/*
        Emplacement physique du colis.

        Savoir qu'un colis est « à Bambeto » ne dit pas sur quelle étagère il se trouve. Avec
        plusieurs centaines de colis en attente, l'agent fouille à chaque client. Le champ se
        modifie directement ici, sans passer par la fenêtre de modification : c'est un geste
        qu'on fait en manipulant le colis, pas au bureau.
      */}
      {["Arrivé", "Disponible au retrait"].includes(colis.status) && !colis.remise && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
                      background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 10,
                      padding: "10px 14px", marginBottom: 18 }}>
          <MapPin size={15} color="var(--muted)" />
          <span style={{ fontSize: 12.5, color: "var(--muted)" }}>Emplacement</span>
          <input
            value={emplacement}
            onChange={(e) => setEmplacement(e.target.value)}
            onBlur={() => { if (emplacement !== (colis.emplacement || "")) onUpdate({ emplacement: emplacement.trim() }); }}
            placeholder="Rayon A3, étagère 2…"
            style={{ ...inputStyle, marginBottom: 0, flex: 1, minWidth: 150 }} />
        </div>
      )}

      {colis.codeRetrait && !colis.remise && colis.status === "Disponible au retrait" && (
        <div style={{ background: "var(--info-bg)", border: "1px solid var(--info-border)", borderRadius: 10, padding: "12px 14px", marginBottom: 18, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 11.5, color: "var(--muted)" }}>Code de retrait envoyé au client</div>
            <div style={{ fontFamily: "monospace", fontSize: 22, fontWeight: 700, letterSpacing: 4, color: "var(--info-fg)" }}>{colis.codeRetrait}</div>
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", maxWidth: 230 }}>
            À demander au comptoir. Le client l’a reçu par WhatsApp avec l’adresse de retrait.
          </div>
        </div>
      )}

      {colis.remise && (
        <div style={{ background: "var(--ok-bg)", border: "1px solid var(--ok-border)", borderRadius: 10, padding: "12px 14px", marginBottom: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ok-fg)", marginBottom: 6 }}>Preuve de remise</div>
          <div style={{ fontSize: 12.5, color: "var(--text)" }}>
            Remis à <strong>{colis.remise.nom}</strong>
            {colis.remise.lien === "proche" ? " (un proche)" : colis.remise.lien === "mandataire" ? " (mandataire)" : ""}
          </div>
          {colis.remise.typePiece && (
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>
              {colis.remise.typePiece}{colis.remise.numeroPiece ? ` — ${colis.remise.numeroPiece}` : ""}
            </div>
          )}
          {colis.remise.note && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>{colis.remise.note}</div>}
          {colis.remise.sansCode && (
            <div style={{ fontSize: 11.5, color: "var(--warn-fg)", marginTop: 5, fontWeight: 600 }}>
              Remis sans présentation du code
            </div>
          )}
          {colis.remise.codeVerifie && (
            <div style={{ fontSize: 11.5, color: "var(--ok-fg)", marginTop: 5, fontWeight: 600 }}>
              Code de retrait vérifié
            </div>
          )}
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>
            {new Date(colis.remise.date).toLocaleString("fr-FR")} · par {colis.remise.agent}
          </div>
        </div>
      )}

      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text)", marginBottom: 10 }}>Historique de suivi</div>
        {colis.historique.map((h, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 10, paddingBottom: 8, borderBottom: i < colis.historique.length - 1 ? "1px solid var(--border)" : "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: h.status === "Annulé" ? "var(--brand-solid)" : "#3ECB84" }} />
              <div style={{ fontSize: 13, color: "var(--text)", fontWeight: 600 }}>{h.status}</div>
              <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{new Date(h.date).toLocaleString("fr-FR")}</div>
            </div>
            {(h.utilisateur || h.agence) && (
              <div style={{ fontSize: 11, color: "var(--muted)", marginLeft: 18 }}>
                {h.utilisateur && `par ${h.utilisateur}`}{h.agence && ` · agence ${h.agence}`}{h.motif && ` · motif : ${h.motif}`}
              </div>
            )}
          </div>
        ))}
      </div>

      {isChauffeur && (
        <div style={{ background: "var(--surface2)", borderRadius: 12, padding: 16, marginBottom: 18 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text)", marginBottom: 10 }}>Outils chauffeur</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            <button onClick={locate} style={smallBtn}><Navigation size={13} /> Localiser ma position</button>
            <a href={loc ? `https://www.google.com/maps/dir/?api=1&destination=${loc.lat},${loc.lng}` : "#"} target="_blank" rel="noreferrer" style={{ ...smallBtn, textDecoration: "none", pointerEvents: loc ? "auto" : "none", opacity: loc ? 1 : 0.5 }}><MapPin size={13} /> Ouvrir la navigation</a>
            <label style={{ ...smallBtn, cursor: "pointer" }}><Camera size={13} /> Photo de livraison<input type="file" accept="image/*" onChange={capturePhoto} style={{ display: "none" }} /></label>
          </div>
          {loc && <iframe title="carte" style={{ width: "100%", height: 160, border: "none", borderRadius: 8, marginBottom: 12 }} src={`https://www.openstreetmap.org/export/embed.html?bbox=${loc.lng-0.01},${loc.lat-0.01},${loc.lng+0.01},${loc.lat+0.01}&marker=${loc.lat},${loc.lng}`} />}
          {colis.pod && <img src={colis.pod} alt="Preuve de livraison" style={{ width: "100%", borderRadius: 8, marginBottom: 12 }} />}
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}><PenTool size={13} /> Signature du destinataire</div>
          <canvas ref={sigRef} width={520} height={100} style={{ width: "100%", height: 100, background: "#F4F6FB", borderRadius: 8, border: "1.5px solid var(--border)", touchAction: "none" }}
            onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={() => drawing && endDraw()}
            onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw} />
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", gap: 14 }}>
          {canManage && <button onClick={() => setShowLitige(true)} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "1px solid var(--warn-border)", color: "var(--warn-fg)", borderRadius: 8, padding: "8px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}><AlertTriangle size={14} /> {colis.litige?.statut === "Ouvert" ? "Résoudre le litige" : "Signaler un litige"}</button>}
          {isAdmin && <button onClick={() => setEditing(true)} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "var(--text)", fontSize: 13, cursor: "pointer" }}><Settings size={14} /> Modifier</button>}
          {effectivePermission(session, "colis.supprimer") && <button onClick={() => setConfirmerSuppression(true)} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "var(--danger-fg)", fontSize: 13, cursor: "pointer" }}><Trash2 size={14} /> Supprimer</button>}
          {effectivePermission(session, "colis.annuler") && colis.status !== "Annulé" && colis.status !== "Livré" && colis.status !== "Refusé" && <button onClick={() => setCancelling(true)} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "var(--warn-fg)", fontSize: 13, cursor: "pointer" }}><AlertTriangle size={14} /> Annuler le colis</button>}
          {effectivePermission(session, "colis.annuler") && ["Disponible au retrait", "Arrivé"].includes(colis.status) && <button onClick={() => setRefusing(true)} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "var(--danger-fg)", fontSize: 13, cursor: "pointer" }}><X size={14} /> Marquer refusé / retourné</button>}
          {canManage && (
            <label style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text)", fontSize: 13, cursor: "pointer" }}>
              <Camera size={14} /> {uploadingPhoto ? "Envoi…" : colis.photoEntrepot ? "Changer la photo" : "Ajouter une photo"}
              <input type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setUploadingPhoto(true);
                try { const dataUrl = await resizeImageToDataUrl(file); onUpdate({ photoEntrepot: dataUrl }); }
                catch (err) { console.error("Échec du traitement de la photo", err); }
                setUploadingPhoto(false);
                e.target.value = "";
              }} />
            </label>
          )}
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={notifierWhatsApp} disabled={waState === "envoi"} style={{ ...smallBtn, background: "#16A163", color: "#fff", borderColor: "#16A163" }}>
            <MessageCircle size={13} /> {waState === "envoi" ? "Envoi…" : waState === "envoye" ? "Message envoyé" : "Notifier WhatsApp"}
          </button>
          {waState === "brouillon" && <span style={{ fontSize: 11, color: "var(--muted)", alignSelf: "center" }}>Brouillon WhatsApp ouvert — appuyez sur Envoyer</span>}
          {waErreur && <span style={{ fontSize: 11, color: "var(--warn-fg)", alignSelf: "center" }}>{waErreur}</span>}
          <button onClick={handleDownloadLabel} disabled={labelState === "loading"} style={smallBtn}><Printer size={13} /> {labelState === "loading" ? "Génération…" : "Étiquette QR"}</button>
          {labelState === "error" && <span style={{ fontSize: 11, color: "var(--danger-fg)", alignSelf: "center" }}>Échec — réessayez</span>}
          <button onClick={handleDownloadInvoice} disabled={invoiceState === "loading"} style={smallBtn}><Download size={13} /> {invoiceState === "loading" ? "Génération…" : "Facture PDF"}</button>
          {(colis.destinataireEmail || colis.email) && (
            <button onClick={handleEnvoyerFacture} disabled={emailState === "loading"} style={smallBtn}>
              <Mail size={13} /> {emailState === "loading" ? "Envoi…" : emailState === "envoye" ? "Facture envoyée" : emailState === "brouillon" ? "Brouillon ouvert" : "Envoyer par e-mail"}
            </button>
          )}
          <button onClick={handleDownloadTicketThermal} disabled={ticketThermalState === "loading"} style={smallBtn}><Receipt size={13} /> {ticketThermalState === "loading" ? "Génération…" : "Ticket thermique 80mm"}</button>
          {invoiceState === "error" && <span style={{ fontSize: 11, color: "var(--danger-fg)", alignSelf: "center" }}>Échec — réessayez</span>}
          {canManage && !isLast && colis.status !== "Annulé" && colis.status !== "Refusé" && <button onClick={onAdvance} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 8, border: "none", background: "var(--brand-solid)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Statut suivant <ChevronRight size={14} /></button>}
        </div>
      </div>
      {cancelling && (
        <div style={{ marginTop: 14, background: "var(--danger-bg)", borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 12.5, color: "var(--danger-fg)", fontWeight: 700, marginBottom: 8 }}>Confirmer l’annulation du colis</div>
          <input value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Motif de l’annulation" style={{ ...inputStyle, marginBottom: 10 }} />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button onClick={() => { setCancelling(false); setMotif(""); }} style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 12.5, cursor: "pointer" }}>Retour</button>
            <button onClick={() => { onCancel(motif); setCancelling(false); setMotif(""); }} style={{ background: "var(--brand-solid)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>Confirmer l’annulation</button>
          </div>
        </div>
      )}
      {refusing && (
        <div style={{ marginTop: 14, background: "var(--danger-bg)", borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 12.5, color: "var(--danger-fg)", fontWeight: 700, marginBottom: 8 }}>Le destinataire a refusé le colis</div>
          <input value={motifRefus} onChange={(e) => setMotifRefus(e.target.value)} placeholder="Motif du refus (ex : article non conforme, absent...)" style={{ ...inputStyle, marginBottom: 10 }} />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button onClick={() => { setRefusing(false); setMotifRefus(""); }} style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 12.5, cursor: "pointer" }}>Retour</button>
            <button onClick={() => { onRefuser(motifRefus); setRefusing(false); setMotifRefus(""); }} style={{ background: "var(--brand-solid)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>Confirmer le refus</button>
          </div>
        </div>
      )}
      {colis.photoEntrepot && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 6 }}>Photo à l’entrepôt</div>
          <img src={colis.photoEntrepot} alt="Photo du colis" style={{ maxWidth: 260, borderRadius: 12, border: "1px solid var(--border)" }} />
        </div>
      )}
      {colis.status === "Refusé" && colis.retour && (
        <div style={{ marginTop: 14, background: "var(--warn-bg)", border: "1px solid var(--warn-border)", borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 12.5, color: "var(--warn-fg)", fontWeight: 700, marginBottom: 6 }}>Suivi du retour</div>
          {colis.retour.motif && <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>Motif : {colis.retour.motif}</div>}
          {canManage ? (
            <select value={colis.retour.statutRetour} onChange={(e) => onMajRetour(e.target.value)} style={inputStyle}>
              <option>En attente de décision</option>
              <option>Retour en cours vers l’expéditeur</option>
              <option>Remboursé</option>
              <option>Réexpédié au destinataire</option>
              <option>Colis détruit / abandonné</option>
            </select>
          ) : (
            <div style={{ fontSize: 12.5, color: "var(--text)" }}>{colis.retour.statutRetour}</div>
          )}
        </div>
      )}
      {showLitige && <LitigeModal colis={colis} onDeclarer={onDeclarerLitige} onResoudre={onResoudreLitige} onClose={() => setShowLitige(false)} />}
      {confirmerSuppression && (
        <ConfirmerAction
          titre="Supprimer ce colis ?"
          message={`Le colis ${colis.tracking} (${colis.destinataire}) sera définitivement supprimé.`}
          consequence="Son historique, ses paiements et ses documents disparaissent avec lui. Cette action ne peut pas être annulée — réservée aux administrateurs."
          onConfirmer={() => { setConfirmerSuppression(false); onDelete(); }}
          onAnnuler={() => setConfirmerSuppression(false)}
        />
      )}
      {editing && <EditColisForm colis={colis} categories={data?.categories} remiseVolumeConfig={data?.remiseVolume} tarifsReception={data?.receptionTarifs} onClose={() => setEditing(false)} onSave={(patch) => { onUpdate(patch); setEditing(false); }} />}
      {bonSortieOuvert && (
        <Modal onClose={() => setBonSortieOuvert(false)} title="Enregistrer la remise du colis">
          <Field label="Nom de la personne qui récupère le colis *"><input value={recupNom} onChange={(e) => setRecupNom(e.target.value)} style={inputStyle} /></Field>
          <Field label="Numéro de téléphone *"><input value={recupTel} onChange={(e) => setRecupTel(e.target.value)} style={inputStyle} /></Field>
          <Field label="Numéro de pièce d’identité (facultatif)"><input value={recupPiece} onChange={(e) => setRecupPiece(e.target.value)} style={inputStyle} placeholder="CNI, passeport..." /></Field>
          <Field label="Date (facultatif)"><input type="date" value={recupDate} onChange={(e) => setRecupDate(e.target.value)} style={inputStyle} /></Field>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
            <button onClick={() => setBonSortieOuvert(false)} style={{ padding: "10px 18px", borderRadius: 8, border: "1.5px solid var(--border)", background: "var(--surface)", color: "var(--muted)", fontSize: 13.5, cursor: "pointer" }}>Annuler</button>
            <button onClick={validerBonSortie} style={{ padding: "10px 18px", borderRadius: 8, border: "none", background: "#3D63FF", color: "#fff", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>Enregistrer</button>
          </div>
        </Modal>
      )}
    </Modal>
  );
}
const smallBtn = { display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 8, border: `1.5px solid ${BORDER}`, background: SURFACE2, color: MUTED, fontSize: 12.5, cursor: "pointer" };

const Info = memo(function Info({ label, value, accent }) {
  return <div><div style={{ fontSize: 11, color: MUTED }}>{label}</div><div style={{ fontSize: 14, color: accent ? RED : TEXT, fontWeight: 600 }}>{value}</div></div>;
});

/** Construit un annuaire client unique (téléphone) à partir de l’historique des colis, côté expéditeur ET destinataire. */
/** Ne garde que les chiffres significatifs d'un numéro : « +224 622 11 11 11 » et
 *  « 622111111 » désignent la même personne, mais créaient deux fiches distinctes. */
/**
 * Prépare un texte pour la recherche : sans accents, en minuscules.
 *
 * Beaucoup de vos clients portent des noms accentués — Touré, Condé, Sidibé, Traoré. Un agent
 * pressé tape rarement les accents, et le client devenait introuvable. La recherche compare
 * désormais des textes normalisés des deux côtés.
 */
function pourRecherche(texte) {
  return String(texte || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function normaliserTelephone(tel) {
  const chiffres = String(tel || "").replace(/\D/g, "");
  return chiffres.length > 9 ? chiffres.slice(-9) : chiffres;
}

/** Compare deux noms en ignorant accents, casse et ordre des mots (« Diallo Mariama »
 *  et « mariama diallo » sont la même personne). */
function normaliserNom(nom) {
  return String(nom || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z ]/g, " ")
    .split(/\s+/).filter(Boolean).sort().join(" ");
}

/**
 * Repère les fiches clients qui désignent probablement la même personne.
 *
 * Deux cas fréquents, tous deux invisibles jusqu'ici :
 *   - le même numéro noté différemment (avec ou sans indicatif, avec des espaces) : deux fiches
 *     séparées, donc un historique d'envois coupé en deux et une remise fidélité jamais atteinte ;
 *   - le même numéro avec des orthographes de nom différentes : une seule fiche, mais le nom
 *     change au gré du dernier colis enregistré.
 */
function detecterDoublonsClients(clients) {
  const parTelephone = {};
  const parNom = {};
  clients.forEach((c) => {
    const tel = normaliserTelephone(c.telephone);
    if (tel) (parTelephone[tel] = parTelephone[tel] || []).push(c);
    const nom = normaliserNom(c.nomComplet);
    if (nom) (parNom[nom] = parNom[nom] || []).push(c);
  });

  const groupes = [];
  Object.entries(parTelephone).forEach(([tel, liste]) => {
    if (liste.length > 1) {
      groupes.push({ cle: `tel-${tel}`, motif: "Même numéro noté différemment", fiches: liste });
    }
  });
  Object.entries(parNom).forEach(([nom, liste]) => {
    const tels = [...new Set(liste.map((c) => normaliserTelephone(c.telephone)).filter(Boolean))];
    if (liste.length > 1 && tels.length > 1) {
      groupes.push({ cle: `nom-${nom}`, motif: "Même nom, numéros différents", fiches: liste });
    }
  });
  return groupes;
}

/**
 * Répertoire repris de l'ancienne plateforme, lu sur les captures d'écran fournies.
 *
 * ATTENTION — ces fiches sont marquées « à vérifier » (champ `aVerifier`). Les numéros ont été
 * lus sur des photos d'écran : certains chiffres pouvaient être flous ou coupés. Une erreur d'un
 * seul chiffre rend un client injoignable, il faut donc confirmer chaque fiche au premier contact.
 * L'agent confirme d'un clic depuis la page Clients, et le repère disparaît.
 *
 * Il manque environ 40 clients (383 sur l'ancienne plateforme) : les pages 1 à 40 n'étaient pas
 * dans les captures. Ils sont à ajouter à la main.
 */
const REPERTOIRE_IMPORTE = [
  { n: "aboubacar bah", t: "+224624538625" },
  { n: "djoulde bah", t: "+224627260728" },
  { n: "fatoumata bah", t: "+33780597034" },
  { n: "fatoumata lamarana bah", t: "+224623435322" },
  { n: "guraissy bah", t: "+224624924566" },
  { n: "koundouba bah", t: "+224627290816" },
  { n: "mamadou djoumah bah", t: "+224622015589" },
  { n: "mamadou saliou bah", t: "+49622636470" },
  { n: "mariama bah", t: "+224625278583" },
  { n: "mariama cire bah", t: "+22626938617" },
  { n: "oury bah", t: "+49629595970" },
  { n: "thierno bah", t: "+33768408027" },
  { n: "yaya bah", t: "+33768551442" },
  { n: "hassanatou balde", t: "+224624364647" },
  { n: "hawaou balde", t: "+224623385065" },
  { n: "mariama cire baldé", t: "+224626228348" },
  { n: "souleymane baldé", t: "+49627859734" },
  { n: "aly bamba", t: "+224621425829" },
  { n: "hawa bamba", t: "+224622598314" },
  { n: "ibrahima bangoura", t: "+224620174697" },
  { n: "ousmanr bangoura", t: "+224611726034" },
  { n: "fatoumata bangoura", t: "+224627099308" },
  { n: "ibrahima bangoura", t: "+49664495257" },
  { n: "mariame bangoura", t: "+224613964512" },
  { n: "m'balia bangoura", t: "+33766814454" },
  { n: "naby laye bangoura", t: "+224621574031" },
  { n: "boubacar barry", t: "+224627585505" },
  { n: "hawa barry", t: "+224626698367" },
  { n: "kadjaliou barry", t: "+224622251487" },
  { n: "mamadou barry", t: "+224628103829" },
  { n: "mamadou dian barry", t: "+224623193961" },
  { n: "oumou tabara barry", t: "+224624597514" },
  { n: "ramatoulaye barry", t: "+224622543649" },
  { n: "abdourahmane barry", t: "+224623532352" },
  { n: "boubacar barry", t: "+224620356729" },
  { n: "djoulde barry", t: "+33758370589" },
  { n: "fatoumata binta barry", t: "+224628128143" },
  { n: "fatoumata djaraye barry", t: "+224628068063" },
  { n: "mariama barry", t: "+224622308700" },
  { n: "mariame barry", t: "+224620910880" },
  { n: "muhammed barry", t: "+224621528148", e: "famous.hayere@gmail.com" },
  { n: "oury bailo barry", t: "+224612954810" },
  { n: "salimatou barry", t: "+224655870323" },
  { n: "souleymane barry", t: "+224623308070" },
  { n: "yero barry", t: "+224611167920" },
  { n: "mouhamed lamine bayo", t: "+224622227448" },
  { n: "anama bayo", t: "+224620421523" },
  { n: "fatoumata berete", t: "+49758386706" },
  { n: "fatoumata berete", t: "+33758386706", e: "djeneefanta94@gmail.com" },
  { n: "hawa berete", t: "+33751520116" },
  { n: "moussa tiranke berete", t: "+224628813950", e: "mtberete@gmail.com" },
  { n: "bramx bramx", t: "+33768122438" },
  { n: "aissata camara", t: "+224624194189" },
  { n: "alseny camara", t: "+224627624077" },
  { n: "ba fode morcane camara", t: "+224622341229" },
  { n: "celestin camara", t: "+224622292953" },
  { n: "ibrahima camara", t: "+22622144906" },
  { n: "ibrahima camara", t: "+224620179927" },
  { n: "mamadama camara", t: "+224625306536" },
  { n: "mamadama camara", t: "+224625306537" },
  { n: "mariame camara", t: "+33783334930", e: "mariecamara878@gmail.com" },
  { n: "m'mah camara", t: "+224626743509" },
  { n: "sekouba camara", t: "+224625240843" },
  { n: "abdoulaye camara", t: "+224611711143" },
  { n: "aicha camara", t: "+224623696000" },
  { n: "aly rouen camara", t: "+33606419460" },
  { n: "aminata camara", t: "+224622216028" },
  { n: "aminata camara", t: "+224621247737" },
  { n: "fatima bintou camara", t: "+224620749159" },
  { n: "fatoumata camara", t: "+224610302769" },
  { n: "fode mouhamadou camara", t: "+224620202597" },
  { n: "ibrahima camara", t: "+224622144906" },
  { n: "ibrahima sory camara", t: "+224627162055" },
  { n: "kadiza camara", t: "+33778329313" },
  { n: "karamba camara", t: "+33612600777" },
  { n: "laye camara", t: "+224625065193" },
  { n: "mayeni camara", t: "+224626198781" },
  { n: "mme camara", t: "+224624725085" },
  { n: "morlaye camara", t: "+224621734444" },
  { n: "naminata camara", t: "+33603295186" },
  { n: "salif camara", t: "+224629358239" },
  { n: "nounou camaraa", t: "+33673924171" },
  { n: "nounou camaraa", t: "+33758993786" },
  { n: "aladji cisse", t: "+33758063848", e: "tikendjahcisse@gmail.com" },
  { n: "hirene cisse", t: "+224624816669" },
  { n: "lonceny cisse", t: "+224620052542" },
  { n: "moussa mariam cisse", t: "+224627695350" },
  { n: "aboubacar cissé", t: "+49780051002", e: "koundouba@yahoo.fr" },
  { n: "ibou cl", t: "+33623161085", e: "famous.hayere@gmail.com" },
  { n: "ahmed conde", t: "+224620574183" },
  { n: "aminata conde", t: "+224626882109" },
  { n: "fanta conde", t: "+33604128349" },
  { n: "la belle soeur de fanta conde", t: "+33751188872" },
  { n: "lamine conde", t: "+33781820660" },
  { n: "moussa conde", t: "+224624461879" },
  { n: "mr conde", t: "+224628683515" },
  { n: "prince conde", t: "+33766832214" },
  { n: "seckou conde", t: "+33753775050" },
  { n: "aly mariame condé", t: "+224611201212" },
  { n: "hamidou condé", t: "+224629310012" },
  { n: "maleny conte", t: "+224627292701" },
  { n: "emmanuel correah", t: "+224627929880" },
  { n: "oumar dabo", t: "+224629429140" },
  { n: "seckou dabo", t: "+33617185305" },
  { n: "kadiatou dallo", t: "+224624637650" },
  { n: "maodo dell", t: "+33668324539" },
  { n: "mme delphine", t: "+224628209640" },
  { n: "maman de papo", t: "+224622320875" },
  { n: "sona diabaté", t: "+224627165018" },
  { n: "alkhaly diaby", t: "+224620990433" },
  { n: "lassana diaby", t: "+224628047406" },
  { n: "djaraye diaby", t: "+224610120814" },
  { n: "fine diaby", t: "+33751419202" },
  { n: "gassama diaby", t: "+224621022228" },
  { n: "goundoba diaby", t: "+33605877468" },
  { n: "lanssana diaby", t: "+33758757832" },
  { n: "oumar diaby", t: "+224613045289", e: "badiabyexpress.bde@gmail.com" },
  { n: "ousmane diaby", t: "+224623870026" },
  { n: "fatoumata diakhaby", t: "+224620428398" },
  { n: "adama hawa diallo", t: "+224611949029" },
  { n: "alpha diallo", t: "+12069605294" },
  { n: "alpha diallo", t: "+49625201405", e: "ousmane816077@gmail.com" },
  { n: "assiatou diallo", t: "+224621228568" },
  { n: "fatoumata diallo", t: "+224622844093" },
  { n: "fatoumata binta diallo", t: "+224661139740" },
  { n: "fatoumata binta diallo", t: "+224626815211" },
  { n: "ibrahima diallo", t: "+224612162226" },
  { n: "ibrahima diallo", t: "+221611122270" },
  { n: "karimata diallo", t: "+224624383433" },
  { n: "mamadou alpha diallo", t: "+224620059495" },
  { n: "mamadou mouctar diallo", t: "+224628177163" },
  { n: "saïd diallo", t: "+224628061099" },
  { n: "saliou djan diallo", t: "+224620085461" },
  { n: "souleymane diallo", t: "+224628284732" },
  { n: "abdourahmane diallo", t: "+224628318478" },
  { n: "alassane diallo", t: "+224625235544" },
  { n: "aloha diallo", t: "+33753789750" },
  { n: "alpha diallo", t: "+33641293656" },
  { n: "alpha diallo", t: "+12069605254" },
  { n: "amadou diallo", t: "+221775780281" },
  { n: "amadou sadio diallo", t: "+49623192559" },
  { n: "amadou sadjo diallo", t: "+224666043708" },
  { n: "amadou tidiane diallo", t: "+33780789468" },
  { n: "aminata diallo", t: "+393510780598" },
  { n: "aminata diallo", t: "+224625864688" },
  { n: "elhadji mamadou diallo", t: "+224622222903" },
  { n: "fanta diallo", t: "+224620159884" },
  { n: "fanta diallo", t: "+224629823075" },
  { n: "fatoumata diarraye diallo", t: "+224628604325" },
  { n: "fatoumata djoulde diallo", t: "+2246211603231" },
  { n: "fatoumata djoulde diallo", t: "+224621603231" },
  { n: "ibrahima diallo", t: "+224624830921" },
  { n: "maïmouna diallo", t: "+224622310736" },
  { n: "mamadou diallo", t: "+224620710034" },
  { n: "mamadou alimou diallo", t: "+49621354117" },
  { n: "mamadou mouctar diallo", t: "+49628177123" },
  { n: "mamadou saidou diallo", t: "+33656721853" },
  { n: "mariama diallo", t: "+224625688899" },
  { n: "mr diallo", t: "+224613037333" },
  { n: "souleymane diallo", t: "+49627390660" },
  { n: "thierno mahmoud diallo", t: "+224620251653" },
  { n: "siaka diawara", t: "+224621516924" },
  { n: "lansana diawara", t: "+224629959232" },
  { n: "hawa dieye", t: "+224611286465" },
  { n: "thierno dillo", t: "+33769710135" },
  { n: "j.o diop", t: "+224611159454", e: "badiabyexpress.bde@gmail.com" },
  { n: "toure djimo", t: "+33652591510" },
  { n: "djouwe djouwe", t: "+33751183947" },
  { n: "ibrahima donzo", t: "+224620212770" },
  { n: "moriba dougouno", t: "+33623080764" },
  { n: "aissatou doumbouya", t: "+224626558340" },
  { n: "fatoumata doumbouya", t: "+224621969844" },
  { n: "hadja mahawa doumbouya", t: "+224620001058" },
  { n: "maguette doumbouya", t: "+224611491953" },
  { n: "séréfi doumbouya", t: "+224625660696" },
  { n: "aicha doumbouya", t: "+33782616462" },
  { n: "ibrahima kalil doumbouya", t: "+22669175189" },
  { n: "ibrahima kalil doumbouya", t: "+224669175189" },
  { n: "maïssata doumbouyah", t: "+224629631151" },
  { n: "kadiatou doumbouyah", t: "+224628554800" },
  { n: "saraba drame", t: "+224625208083" },
  { n: "banfa drame", t: "+33652884808" },
  { n: "n'na mariama drame", t: "+33652930499" },
  { n: "soukama drame", t: "+33640287236" },
  { n: "fatoumata duaby", t: "+224622145605" },
  { n: "abdoulaye elhadji", t: "+224628770004" },
  { n: "mariata eoumanigui", t: "+224622002236" },
  { n: "hadja fatou fadiga", t: "+224620203043" },
  { n: "diallo fatoumata binta", t: "+33753381481" },
  { n: "fatoumata fofana", t: "+224624120622" },
  { n: "hawa fofana", t: "+224628375686" },
  { n: "lamine fofana", t: "+224620085937" },
  { n: "maciré ben fofana", t: "+224622310753" },
  { n: "mr fofana", t: "+224623519577" },
  { n: "abdoulaye fofana", t: "+224622389780" },
  { n: "fatoumata fofana", t: "+49627159536" },
  { n: "fatoumata fofana", t: "+224627159536" },
  { n: "fatoumata fofana", t: "+224624180622" },
  { n: "mme fofana", t: "+224622727540" },
  { n: "moussa fofana", t: "+224622084314" },
  { n: "youlia fofana", t: "+224628138941" },
  { n: "marie yvette foulah", t: "+33754834160" },
  { n: "oumou gassama", t: "+33604494053" },
  { n: "laurent gbamou", t: "+224623451975" },
  { n: "mohamed lamine guirassy", t: "+224622329457" },
  { n: "hariete heloumou", t: "+224623278782" },
  { n: "diallo ibdiallo", t: "+224611122270" },
  { n: "abdoulaye kaba", t: "+224625907575" },
  { n: "abdoul bachir kaba", t: "+224629245656" },
  { n: "djenabiou kaba", t: "+224660992080" },
  { n: "mamadi kaba", t: "+49625158826" },
  { n: "kandjigora kadiatou", t: "+33771819496" },
  { n: "mme kakimbo", t: "+224664222141" },
  { n: "hadja kande", t: "+33785374045" },
  { n: "bintou kante", t: "+33610867943" },
  { n: "mohamed kante", t: "+33780596626" },
  { n: "kerfala kebe", t: "+224627505872", e: "kerfalakebe97@gmail.com" },
  { n: "moussa keita", t: "+224627017667" },
  { n: "aissata keita", t: "+33781749245" },
  { n: "moussa keita", t: "+224660208877" },
  { n: "oumar keita", t: "+224628168051" },
  { n: "saran koma", t: "+33628778057" },
  { n: "oumou konate", t: "+33621277276", e: "oumoukonate14@hotmail.fr" },
  { n: "fatoumata konate", t: "+224621213729" },
  { n: "aicha konate", t: "+224622093398" },
  { n: "el kounfia", t: "+33672426366", e: "famous.hayere@gmail.com" },
  { n: "mouhamed kourouma", t: "+224626284647" },
  { n: "ayoub kourouma", t: "+224628468689" },
  { n: "issa kourouma", t: "+49621649704" },
  { n: "issa kourouma", t: "+224621649704" },
  { n: "tiemoko kourouma", t: "+224625942340" },
  { n: "yaya kouroumq", t: "+224613969102" },
  { n: "fatoumata kouyate", t: "+224621288828" },
  { n: "aminata kouyate", t: "+33613918089" },
  { n: "aminata kouyate", t: "+33758060315" },
  { n: "kadiatou kouyaté", t: "+49629541160" },
  { n: "catherine lamah", t: "+224622160768" },
  { n: "nyan kwita charles lega", t: "+224625368376" },
  { n: "fatoumata madane", t: "+33777034948" },
  { n: "mouhamed magane", t: "+224613396305" },
  { n: "batoul magane", t: "+224628942411" },
  { n: "fanta magane", t: "+33662012332" },
  { n: "bangoura mouhamed lamine.", t: "+224611193022" },
  { n: "ya moussa", t: "+224623126598" },
  { n: "mohamed mozalin", t: "+224626246724" },
  { n: "thiianguil multi service", t: "+224611835683" },
  { n: "fatoumata nabe", t: "+33753765901" },
  { n: "khalifa nabé", t: "+224624916306" },
  { n: "hadja namou", t: "+33787822249" },
  { n: "n'dela n'dela", t: "+33762632305" },
  { n: "binta ndiaye", t: "+224621353537" },
  { n: "maman papi", t: "+22462230875" },
  { n: "coa partenaire", t: "+22462222903" },
  { n: "saraba sacko", t: "+224623929815" },
  { n: "hadja aicha sacko", t: "+224622583089" },
  { n: "ibrahima sacko", t: "+33641275989" },
  { n: "nasou sacko", t: "+224629930451" },
  { n: "n na aissata sacko", t: "+33768593619" },
  { n: "m'mah sakho", t: "+224620757279" },
  { n: "hassanatou sambo", t: "+33759197378" },
  { n: "mbalou samourah", t: "+224623067565" },
  { n: "diaby senegalais", t: "+224613080456" },
  { n: "hadja siata", t: "+224628240465" },
  { n: "aminata sidibe", t: "+224623977879" },
  { n: "mohamed sidibe", t: "+49625958449" },
  { n: "muhamed sidibe", t: "+224626941779" },
  { n: "ahmed tidiane sidibé", t: "+224613311060" },
  { n: "diaby sidiya", t: "+33641201835" },
  { n: "rabiatou souare", t: "+224621751768" },
  { n: "mohamed soumah", t: "+224622923083" },
  { n: "aminata soumah", t: "+224626173993" },
  { n: "issiaga soumah", t: "+224611911644" },
  { n: "mabintou soumah", t: "+224620838074" },
  { n: "mama nana soumah", t: "+224629684722" },
  { n: "mr thiam soumah", t: "+3306218069304" },
  { n: "abdoul karim soumah camara", t: "+33753493367" },
  { n: "boubacar sow", t: "+224622091237" },
  { n: "mamadou lamarana sow", t: "+224620599288" },
  { n: "oumar sow", t: "+224621224948" },
  { n: "ramatoulaye sow", t: "+224624735474" },
  { n: "aissatou bily sow", t: "+224622865086" },
  { n: "amadou sow", t: "+224622326166" },
  { n: "aminatou sow", t: "+224624138835" },
  { n: "habibou sow", t: "+224623046611" },
  { n: "mamadou dian sow", t: "+224623356932" },
  { n: "mamadou djoulde sow", t: "+224620923675" },
  { n: "ousmane sow", t: "+224628400956" },
  { n: "ousmane sow", t: "+49628400956" },
  { n: "mariam sy", t: "+224622647422" },
  { n: "aboubacar sylla", t: "+224622147164" },
  { n: "amadou sylla", t: "+224622033699" },
  { n: "benoit sylla", t: "+224622005365" },
  { n: "fatoumata sylla", t: "+224613446129" },
  { n: "lamine sylla", t: "+224622405815" },
  { n: "moussa sylla", t: "+224629263603" },
  { n: "nabintou sylla", t: "+224621792479" },
  { n: "ousmane sylla", t: "+224622737808" },
  { n: "ousmane sylla", t: "+224629625515" },
  { n: "yafode sylla", t: "+224613054876" },
  { n: "zenab sylla", t: "+33781242374" },
  { n: "abdoualye sylla", t: "+224628295041" },
  { n: "abdoulaye sylla", t: "+224621114717" },
  { n: "abdoulaye sylla", t: "+224625832203" },
  { n: "aboubacar sylla", t: "+224624357866" },
  { n: "amadou sylla", t: "+33753722998" },
  { n: "amadou sylla", t: "+33604449595" },
  { n: "mariama cire sylla", t: "+33689653576" },
  { n: "mariama cire sylla", t: "+33689659576" },
  { n: "mariame sylla", t: "+224628469132" },
  { n: "mohamed sylla", t: "+33753090379" },
  { n: "mouhamed sylla", t: "+224660973007" },
  { n: "ousmane sylla", t: "+224629625520" },
  { n: "taminy taminy", t: "+33766043199" },
  { n: "mr thiam", t: "+33621806934", e: "famous.hayere@gmail.com" },
  { n: "mamoudou thierno", t: "+224612145441" },
  { n: "chek ahmed tidiane", t: "+224622500519" },
  { n: "aly tombolia", t: "+224613901670" },
  { n: "djiba toure", t: "+224627552014" },
  { n: "fatoumata dominique toure", t: "+224620126887" },
  { n: "macire toure", t: "+224627449781" },
  { n: "mariame toure", t: "+224628558449" },
  { n: "aissata toure", t: "+224622282762" },
  { n: "aminata toure", t: "+33785948317" },
  { n: "aye toure", t: "+224622126923" },
  { n: "kadiatou toure", t: "+33780559695" },
  { n: "kadiatou toure", t: "+224621682932" },
  { n: "kamalbase toure", t: "+224610888872" },
  { n: "mamadou oury toure", t: "+33751348514" },
  { n: "mariama toure", t: "+224624425914" },
  { n: "moustapha toure", t: "+33766783991" },
  { n: "nana toure", t: "+224628047470" },
  { n: "kakéba touré", t: "+224625494249" },
  { n: "kamalbasse touré", t: "+49610888872" },
  { n: "tanti toutou", t: "+33783963329" },
  { n: "aissatou traore", t: "+224625598025" },
  { n: "ibrahima traore", t: "+224627093411" },
  { n: "fatoumata traore", t: "+224627293246" },
  { n: "facinet traoré", t: "+49628316732" },
  { n: "no yaawi", t: "+224624834960" },
  { n: "abdoulaye yeressa", t: "+224629315255" },
  { n: "mariame youla", t: "+224626160676" },
  { n: "soeur de youla", t: "+224628354009" },
  { n: "alayrangues zoe", t: "+224614220449" },
].map((c, i) => ({
  id: `imp-${i}`,
  nomComplet: c.n,
  telephone: c.t,
  email: c.e || "",
  adresse: "",
  aVerifier: true,
  source: "ancienne plateforme",
}));

/**
 * Données de référence : catégories tarifaires et compte administrateur.
 *
 * Définies ici plutôt qu'en ligne dans les valeurs par défaut, afin de pouvoir les recharger
 * dans une base déjà en service — une plateforme existante ignore les valeurs par défaut, et
 * ces informations lui resteraient sinon inaccessibles.
 */
const DONNEES_REFERENCE = {
  categories: [
      { nom: "Bateau", description: "Envoi par bateau", emoji: "🚢", type: "unite", montant: 250000, deviseSaisie: "GNF", paysLimite: null, motsCles: ["bateau"] },
      { nom: "Beurre de karité (PARIS)", description: "BEURRE DE KARITÉ", emoji: "🧴", type: "kg", montant: 12, deviseSaisie: "EUR", paysLimite: "GN", motsCles: ["Beurre de karité"] },
      { nom: "CHAUSSURE MARQUE (PARIS)", description: "chaussures de marque nike, adidas", emoji: "👟", type: "unite", montant: 30, deviseSaisie: "EUR", paysLimite: null, motsCles: ["adidas", "Nike"] },
      { nom: "Chaussures non marque ou traditionnel (PARIS)", description: "chaussure non marque ou traditionnel", emoji: "👞", type: "kg", montant: 12, deviseSaisie: "EUR", paysLimite: null, motsCles: ["Chaussure non marque", "chaussure traditionnel"] },
      { nom: "COLIS ITALIE", description: "COLIS ITALIE", emoji: "📦", type: "kg", montant: 13, deviseSaisie: "EUR", paysLimite: null, motsCles: ["italie"] },
      { nom: "DOCUMENT B (PARIS)", description: "Passeport", emoji: "📄", type: "unite", montant: 50, deviseSaisie: "EUR", paysLimite: null, motsCles: ["Passeport"] },
      { nom: "DOCUMENT B PROVINCE Française", description: "Passeport", emoji: "📄", type: "unite", montant: 75, deviseSaisie: "EUR", paysLimite: "GN", motsCles: ["passeport"] },
      { nom: "DOCUMENTS A (PARIS)", description: "Extrait de naissance, jugement supplétif, permis, diplôme, attestation, carte", emoji: "📑", type: "unite", montant: 30, deviseSaisie: "EUR", paysLimite: null, motsCles: ["Extrait de naissance", "jugement supplétif", "permis", "diplôme", "attestation", "carte d’identité", "acte de mariage", "acte de divorce", "invitation"] },
      { nom: "Drap (PARIS)", description: "Drap", emoji: "🛏️", type: "kg", montant: 12, deviseSaisie: "EUR", paysLimite: null, motsCles: ["Drap-housse", "Drap plat", "Drap de dessus", "Drap de couverture", "Drap pour lit bébé"] },
      { nom: "Habits 224 (PARIS)", description: "Vêtements de la marque 224 pour l’indépendant", emoji: "👕", type: "kg", montant: 12, deviseSaisie: "EUR", paysLimite: "GN", motsCles: ["Pull 224", "casquette224", "T-shirt224"] },
      { nom: "Habits traditionnel non cousu et cousu (PARIS)", description: "Les habits traditionnels africains", emoji: "🥻", type: "kg", montant: 12, deviseSaisie: "EUR", paysLimite: null, motsCles: ["Pagne africaine", "wax", "bazin", "Robe", "complets", "boubou", "Macky sall", "grand boubou", "tissu"] },
      { nom: "Huile rouge (PARIS)", description: "Huile rouge", emoji: "🫗", type: "kg", montant: 12, deviseSaisie: "EUR", paysLimite: "GN", motsCles: ["Huile rouge"] },
      { nom: "Médicaments liquide 1L et 1.5L", description: "Médicaments liquide", emoji: "💊", type: "unite", montant: 30, deviseSaisie: "EUR", paysLimite: null, motsCles: ["Médicaments liquide 1L"] },
      { nom: "Médicaments liquide Talisman 1 à 500ml (PARIS)", description: "Médicaments liquide petite bouteille", emoji: "💊", type: "unite", montant: 15, deviseSaisie: "EUR", paysLimite: "GN", motsCles: ["Talisman", "330cl", "petit bouteille", "liquide", "500ml"] },
      { nom: "KARAMBA ALY TOMBOLIA", description: "Tarif partenaire", emoji: "🤝", type: "kg", montant: 10, deviseSaisie: "EUR", paysLimite: null, motsCles: ["KARAMBA ALY TOMBOLIA"] },
      { nom: "PARTENAIRE NON YAWII", description: "Tarif partenaire", emoji: "🤝", type: "kg", montant: 8.69, deviseSaisie: "EUR", paysLimite: null, motsCles: ["PARTENAIRE NON YAWII"] },
      { nom: "PARTENAITE THIANGUIL", description: "Tarif partenaire", emoji: "🤝", type: "kg", montant: 8.80, deviseSaisie: "EUR", paysLimite: null, motsCles: ["thianguil"] },
      { nom: "Petit sipas USA", description: "Médicament liquide USA", emoji: "💊", type: "unite", montant: 220000, deviseSaisie: "GNF", paysLimite: null, motsCles: ["sipas"] },
      { nom: "Poisson konkoe (PARIS)", description: "Poisson", emoji: "🐟", type: "kg", montant: 12, deviseSaisie: "EUR", paysLimite: "GN", motsCles: ["Poisson", "konkoe"] },
      { nom: "PRIX PARTENAIRE", description: "Seulement pour les partenaires", emoji: "🤝", type: "kg", montant: 8, deviseSaisie: "EUR", paysLimite: null, motsCles: ["Partenaire"] },
      { nom: "Produit cosmétique (PARIS)", description: "Produits cosmétiques visage et corporel", emoji: "💄", type: "kg", montant: 15, deviseSaisie: "EUR", paysLimite: null, motsCles: ["Crème hydratante", "sérum", "lotion tonique", "gel nettoyant", "gommage", "masque visage", "crème anti-âge", "crème solaire", "Lait corporel", "huile corporelle", "crème éclaircissante", "gommage corporel", "beurre de karité", "gel douche", "savon", "Fond de teint", "poudre", "correcteur", "mascara", "rouge à lèvres", "gloss", "eyeliner", "fard à paupières", "blush", "Baume après-rasage", "mousse à raser", "crème hydratante homme", "huile barbe", "shampooing barbe", "Déodorant", "dentifrice", "bain de bouche", "savon liquide", "lingettes"] },
      { nom: "Sac de marque (Paris)", description: "Sac avec des noms ou logo reconnus", emoji: "👜", type: "unite", montant: 12, deviseSaisie: "EUR", paysLimite: null, motsCles: ["Louis Vuitton", "Gucci", "Bottega Veneta", "Saint Laurent", "Balenciaga", "Fendi", "Valentino", "Prada", "Dior", "Celine", "Hermès"] },
      { nom: "Sac non marque", description: "Sac non reconnu", emoji: "👜", type: "kg", montant: 12, deviseSaisie: "EUR", paysLimite: null, motsCles: ["Non marque"] },
      { nom: "Savon noir (PARIS)", description: "Savon noir", emoji: "🧼", type: "kg", montant: 12, deviseSaisie: "EUR", paysLimite: "GN", motsCles: ["Savon", "savon noir"] },
      { nom: "SHEIN/TEMU", description: "les commandes shein et temu", emoji: "🛍️", type: "kg", montant: 100000, deviseSaisie: "GNF", paysLimite: null, motsCles: ["shein", "temu", "aliexpress"] },
      { nom: "SHEIN /TEMU/ALIEXPRESS", description: "Les achats en ligne ou commande en ligne", emoji: "🛍️", type: "kg", montant: 10, deviseSaisie: "EUR", paysLimite: null, motsCles: ["shein", "temu", "aliexpress"] },
      { nom: "Telephone neuf (PARIS)", description: "téléphone ou smartphone neuf", emoji: "📱", type: "unite", montant: 50, deviseSaisie: "EUR", paysLimite: null, motsCles: ["telephone", "iphone", "samsung", "tecno", "infinix", "smartphone"] },
      { nom: "VETEMENT/HABITS (USA)", description: "pantalon, pull, t-shirt, culotte", emoji: "👕", type: "kg", montant: 250000, deviseSaisie: "GNF", paysLimite: null, motsCles: ["pantalon", "pull", "t-shirt", "culotte"] },
      { nom: "Vêtements de marque (PARIS)", description: "Tous les vêtements de marque et maillots de marque", emoji: "👔", type: "unite", montant: 10, deviseSaisie: "EUR", paysLimite: null, motsCles: ["Zara", "H&M", "Bershka", "Pull&Bear", "Stradivarius", "Uniqlo", "Mango", "Shein", "Primark", "Nike", "Adidas", "Puma", "Jordan", "Supreme", "Off-White", "Stüssy", "Carhartt", "The North Face", "Champion", "Lacoste", "Ralph Lauren", "Calvin Klein", "Tommy Hilfiger", "Gant", "Guess", "Hugo Boss", "Gucci", "Louis Vuitton", "Dior", "Balenciaga", "Chanel", "Fendi", "Versace", "Givenchy", "Sandro", "Maje", "A.P.C.", "Celio", "Kaporal", "Le Coq Sportif", "Okaïdi", "Tape à l’Œil", "Kiabi", "C&A", "DPAM"] },
      { nom: "Autres articles", description: "Catégorie appliquée quand aucune autre ne correspond", emoji: "📦", type: "kg", montant: 12, deviseSaisie: "EUR", paysLimite: null, motsCles: [], parDefaut: true },
  ],
  admin: {
      id: "u1", prenom: "Ibrahima", nom: "Diallo",
      email: "badiabyexpress.bde@gmail.com", telephone: "+224620000000",
      identifiant: "Iboush", role: "Administrateur", twoFA: false,
      motdepasseAlgo: "pbkdf2",
      motdepasseIter: 150000,
      motdepasseSalt: "05072796eb9b2fde046a1ea0c17cc70f",
      motdepasseSecure: "eac54df03597bdaa3d0166a8ebda86f608707a0fc218419dfcf12efdd20f2d0a",
  },
};

function buildClientDirectory(colisList, repertoireEnBase = null) {
  const map = {};
  colisList.forEach((c) => {
    if (c.telephone) {
      const key = c.telephone.trim();
      const entry = { telephone: c.telephone, nomComplet: c.destinataire, prenom: "", nom: c.destinataire, email: c.destinataireEmail || "", adresse: c.destinataireAdresse || "", ville: c.destinataireVille || "", codePostal: c.destinataireCodePostal || "", pays: c.destinatairePays || c.pays, date: c.createdAt, count: 0, total: 0 };
      if (!map[key] || new Date(c.createdAt) > new Date(map[key].date)) map[key] = { ...entry, count: (map[key]?.count || 0), total: (map[key]?.total || 0) };
      map[key].count = (map[key].count || 0) + 1;
      map[key].total = (map[key].total || 0) + c.prix;
    }
    if (c.expediteurTelephone) {
      const key = c.expediteurTelephone.trim();
      if (!map[key]) {
        map[key] = { telephone: c.expediteurTelephone, nomComplet: c.expediteur, prenom: "", nom: c.expediteur, email: c.expediteurEmail || "", adresse: c.expediteurAdresse || "", ville: "", codePostal: "", pays: c.expediteurPays || "GN", date: c.createdAt, count: 0, total: 0 };
      }
    }
  });

  /*
   * Fusion avec le répertoire repris de l'ancienne plateforme.
   *
   * Les fiches issues des colis sont prioritaires : elles reflètent l'activité réelle et leurs
   * numéros ont été saisis par un agent. Une fiche importée n'est ajoutée que si son numéro
   * n'existe pas déjà. La comparaison ignore l'indicatif et les espaces, pour ne pas recréer un
   * doublon quand le même client a été saisi sous une forme différente.
   */
  /*
   * On compare sur le numéro COMPLET, indicatif compris. Comparer sur les 9 derniers chiffres
   * fusionnerait « +224 611122270 » (Guinée) et « +221 611122270 » (Sénégal) : deux personnes
   * peut-être différentes. Perdre un client silencieusement est pire que d'en afficher deux —
   * l'onglet « Doublons possibles » signale ces cas et vous tranchez.
   */
  const dejaPresents = new Set(Object.keys(map).map((t) => String(t).replace(/\D/g, "")).filter(Boolean));
  /*
   * Deux sources pour le répertoire : celui livré avec l'application (valeurs par défaut) et
   * celui éventuellement chargé en base via « Charger les données de référence ». Sur une
   * plateforme déjà en service, seul le second existe.
   */
  const repertoire = repertoireEnBase && repertoireEnBase.length ? repertoireEnBase : REPERTOIRE_IMPORTE;
  repertoire.forEach((c) => {
    const cle = String(c.telephone).replace(/\D/g, "");
    if (!cle || dejaPresents.has(cle)) return;
    dejaPresents.add(cle);
    map[c.telephone] = {
      telephone: c.telephone, nomComplet: c.nomComplet, prenom: "", nom: c.nomComplet,
      email: c.email || "", adresse: "", count: 0, total: 0, date: null,
      aVerifier: true, source: c.source,
    };
  });

  return Object.values(map);
}

function Clients({ data }) {
  const [filtre, setFiltre] = useState("tous");
  const [query, setQuery] = useState("");
  const clients = useMemo(() => buildClientDirectory(data.colis, data.repertoire), [data.colis, data.repertoire]);

  const trenteJours = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const SEUILS_FIDELITE = [3, 6, 11];
  function prochainSeuilInfo(count) {
    const seuil = SEUILS_FIDELITE.find((s) => count < s);
    return seuil ? { seuil, reste: seuil - count } : null;
  }
  let filtered = clients;
  if (filtre === "meilleurs") filtered = [...clients].sort((a, b) => b.total - a.total).slice(0, 20);
  if (filtre === "nouveaux") filtered = clients.filter((c) => c.date && new Date(c.date).getTime() > trenteJours);
  if (filtre === "reguliers") filtered = clients.filter((c) => c.count >= 3);
  if (filtre === "proche_palier") {
    filtered = clients.filter((c) => { const p = prochainSeuilInfo(c.count); return p && p.reste <= 2; })
      .sort((a, b) => prochainSeuilInfo(a.count).reste - prochainSeuilInfo(b.count).reste);
  }
  /*
   * Recherche dans l'annuaire, sur un index préparé d'avance.
   *
   * Normaliser 343 noms à chaque touche frappée bloquait l'interface : le navigateur signalait
   * des attentes de près d'une demi-seconde. L'index est calculé une fois par annuaire, la
   * frappe ne fait plus que comparer des chaînes déjà prêtes.
   */
  const indexAnnuaire = useMemo(
    () => clients.map((c) => ({ client: c, recherche: pourRecherche(`${c.nomComplet} ${c.telephone || ""}`) })),
    [clients]
  );
  if (query) {
    const q = pourRecherche(query);
    const gardes = new Set(indexAnnuaire.filter((e) => e.recherche.includes(q)).map((e) => e.client));
    filtered = filtered.filter((c) => gardes.has(c));
  }

  const doublons = useMemo(() => detecterDoublonsClients(clients), [clients]);
  const tabs = [["tous", "Tous"], ["meilleurs", "Meilleurs clients"], ["nouveaux", "Nouveaux clients"], ["reguliers", "Clients réguliers"], ["proche_palier", "Proches du palier suivant"], ["doublons", `Doublons possibles${doublons.length ? ` (${doublons.length})` : ""}`]];
  // Affichage progressif : la recherche et les filtres portent sur tout l'annuaire, seul le
  // nombre de lignes rendues d'un coup est limité (mesuré : 1,1 s pour 3 000 clients d'un bloc).
  const [nbClientsAffiches, setNbClientsAffiches] = useState(TAILLE_PAGE);
  useEffect(() => { setNbClientsAffiches(TAILLE_PAGE); }, [filtre, query]);
  const clientsVisibles = filtered.slice(0, nbClientsAffiches);

  async function exporterProchesPalier() {
    const XLSX = await loadXLSXLib();
    const prochesPalier = clients.filter((c) => { const p = prochainSeuilInfo(c.count); return p && p.reste <= 2; })
      .sort((a, b) => prochainSeuilInfo(a.count).reste - prochainSeuilInfo(b.count).reste);
    const headers = ["Client", "Téléphone", "Envois", "Envois avant le prochain palier", "Remise au prochain palier"];
    const rows = prochesPalier.map((c) => { const p = prochainSeuilInfo(c.count); return [c.nomComplet, c.telephone, c.count, p.reste, `${loyaltyDiscount(p.seuil)}%`]; });
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([["BA-DIABY EXPRESS — Clients proches du prochain palier fidélité"], [`Export généré le ${new Date().toLocaleDateString("fr-FR")}`], [], headers, ...rows]);
    ws["!cols"] = headers.map(() => ({ wch: 22 }));
    ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } }];
    XLSX.utils.book_append_sheet(wb, ws, "Proches du palier");
    XLSX.writeFile(wb, `clients-proches-palier-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  return (
    <div>
      <h1 style={{ fontFamily: "'Space Grotesk',sans-serif", color: "var(--text)", fontSize: 24, margin: "0 0 4px" }}>Clients</h1>
      <p style={{ color: "var(--muted)", fontSize: 13.5, marginTop: 0, marginBottom: 4 }}>{clients.length} clients · Base de données et historique d’envoi</p>
      <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 0, marginBottom: 18 }}>Astuce : dans "Nouveau colis", tapez le numéro de téléphone d’un client existant pour remplir automatiquement ses informations.</p>

      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        {tabs.map(([k, label]) => (
          <button key={k} onClick={() => setFiltre(k)} style={{ padding: "7px 14px", borderRadius: 20, border: "1.5px solid " + (filtre === k ? "var(--brand-solid)" : "var(--border)"), background: filtre === k ? "var(--brand-solid)" : "var(--surface)", color: filtre === k ? "#fff" : "var(--muted)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>{label}</button>
        ))}
        {filtre === "proche_palier" && (
          <button onClick={exporterProchesPalier} style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--surface)", color: "var(--text)", border: "1.5px solid var(--border)", borderRadius: 20, padding: "7px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}><Download size={13} /> Exporter (Excel)</button>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", marginBottom: 18, maxWidth: 420 }}>
        <Search size={15} color="var(--muted)" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un client par nom ou téléphone..." style={{ border: "none", outline: "none", background: "none", flex: 1, fontSize: 13.5, color: "var(--text)" }} />
      </div>

      {filtre === "doublons" ? (
        doublons.length === 0 ? (
          <div style={{ background: "var(--ok-bg)", border: "1px solid var(--ok-border)", borderRadius: 14, padding: 30, textAlign: "center", color: "var(--ok-fg)", fontSize: 13.5, fontWeight: 600 }}>
            Aucun doublon détecté — votre annuaire est propre.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 12.5, color: "var(--muted)" }}>
              Ces fiches désignent probablement la même personne. Un client réparti sur deux fiches
              n’atteint jamais ses paliers de remise, et son historique d’envois apparaît coupé en deux.
              Pour les fusionner, corrigez le numéro sur les colis concernés (fiche colis → Modifier).
            </div>
            {doublons.map((g) => (
              <div key={g.cle} style={{ background: "var(--warn-bg)", border: "1px solid var(--warn-border)", borderRadius: 12, padding: "14px 16px" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--warn-fg)", marginBottom: 10 }}>{g.motif}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {g.fiches.map((f) => (
                    <div key={f.telephone} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", background: "var(--surface)", borderRadius: 8, padding: "9px 12px" }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{f.nomComplet}</div>
                        <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{f.telephone}</div>
                      </div>
                      <div style={{ fontSize: 11.5, color: "var(--muted)", textAlign: "end" }}>
                        {f.count} envoi{f.count > 1 ? "s" : ""} · {fmtGNF((f.total || 0) * (LIVE_RATES.GNF || CURRENCIES.GNF))}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>
                  Total combiné : {g.fiches.reduce((s, f) => s + (f.count || 0), 0)} envois — remise fidélité applicable : {loyaltyDiscount(g.fiches.reduce((s, f) => s + (f.count || 0), 0))} %
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
      <div style={{ background: "var(--surface)", borderRadius: 14, boxShadow: "0 2px 10px rgba(10,38,71,0.06)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr style={{ background: "var(--surface2)", textAlign: "left" }}>{["Client", "Contact", "Expéditions", "Total dépensé", "Prochain palier", "Remise applicable"].map((h) => <th key={h} style={{ padding: "12px 16px", fontSize: 11.5, color: "var(--muted)", fontWeight: 700 }}>{h}</th>)}</tr></thead>
          <tbody>
            {clientsVisibles.map((c) => (
              <tr key={c.telephone} style={{ borderTop: "1px solid var(--surface2)" }}>
                <td style={{ padding: "12px 16px", fontSize: 13.5, color: "var(--text)", fontWeight: 600 }}>
                  {c.nomComplet}
                  {c.aVerifier && <span title="Numéro repris de l’ancienne plateforme — à confirmer au premier contact" style={{ marginInlineStart: 8, background: "var(--warn-bg)", border: "1px solid var(--warn-border)", color: "var(--warn-fg)", padding: "1px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700 }}>à vérifier</span>}
                  {c.date && new Date(c.date).getTime() > trenteJours && <span style={{ marginLeft: 8, background: "var(--info-bg)", color: "var(--info-fg)", padding: "2px 7px", borderRadius: 12, fontSize: 10 }}>nouveau</span>}
                </td>
                <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--muted)" }}>{c.telephone}{c.email ? ` · ${c.email}` : ""}</td>
                <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--muted)" }}>{c.count}</td>
                <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--muted)" }}>{fmt(c.total, "EUR")}</td>
                <td style={{ padding: "12px 16px", fontSize: 12.5, color: "var(--muted)" }}>
                  {(() => { const p = prochainSeuilInfo(c.count); return p ? `${p.reste} envoi${p.reste > 1 ? "s" : ""} avant -${loyaltyDiscount(p.seuil)}%` : "Palier maximum atteint"; })()}
                </td>
                <td style={{ padding: "12px 16px", fontSize: 13 }}>
                  {loyaltyDiscount(c.count) > 0
                    ? <span style={{ background: "var(--ok-bg-soft)", color: "var(--ok-fg)", padding: "3px 9px", borderRadius: 20, fontSize: 11.5, fontWeight: 700 }}>-{loyaltyDiscount(c.count)}%</span>
                    : <span style={{ color: "var(--muted)" }}>—</span>}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={6} style={{ padding: 20, color: "var(--muted)", fontSize: 13 }}>Aucun client ne correspond.</td></tr>}
          </tbody>
        </table>
        {filtered.length > clientsVisibles.length && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, padding: "14px 16px", borderTop: "1px solid var(--border)", flexWrap: "wrap" }}>
            <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{clientsVisibles.length} affichés sur {filtered.length}</span>
            <button onClick={() => setNbClientsAffiches((n) => n + TAILLE_PAGE)} style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: 8, padding: "7px 16px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
              Afficher {Math.min(TAILLE_PAGE, filtered.length - clientsVisibles.length)} de plus
            </button>
            <button onClick={() => setNbClientsAffiches(filtered.length)} style={{ background: "none", border: "none", color: "var(--info-fg)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
              Tout afficher
            </button>
          </div>
        )}
      </div>
      )}
    </div>
  );
}


Clients = memo(Clients);
function PaiementsPage({ data, notify }) {
  const [filter, setFilter] = useState("tous");
  const colis = data.colis;
  const { withStatus, totalCA, totalEncaisse, totalReste } = useMemo(() => ({
    withStatus: colis.map((c) => ({ ...c, payStatus: c.reste <= 0 ? "solde" : c.paye > 0 ? "partiel" : "impaye" })),
    totalCA: colis.reduce((s, c) => s + c.prix, 0),
    totalEncaisse: colis.reduce((s, c) => s + c.paye, 0),
    totalReste: colis.reduce((s, c) => s + c.reste, 0),
  }), [colis]);
  const filtered = useMemo(() => (filter === "tous" ? withStatus : withStatus.filter((c) => c.payStatus === filter)), [withStatus, filter]);
  const [nbAffiches, setNbAffiches] = useState(TAILLE_PAGE);
  useEffect(() => { setNbAffiches(TAILLE_PAGE); }, [filter]);
  const visibles = useMemo(() => filtered.slice(0, nbAffiches), [filtered, nbAffiches]);
  const labels = { solde: "Soldé", partiel: "Partiel", impaye: "Impayé" };
  const colors = { solde: { bg: "var(--ok-bg-soft)", fg: "var(--ok-fg)" }, partiel: { bg: "var(--warn-bg)", fg: "var(--warn-fg)" }, impaye: { bg: "var(--danger-bg)", fg: "var(--danger-fg)" } };

  const declarationsEnAttente = useMemo(() => colis.filter((c) => (c.declarationsPaiement || []).some((d) => d.statut === "En attente")), [colis]);

  // Impayés à relancer : reste > 0, colis créé depuis plus de 5 jours, pas annulé.
  const [showRelances, setShowRelances] = useState(false);
  const impayesARelancer = useMemo(() => colis
    .filter((c) => c.reste > 0 && c.status !== "Annulé" && (new Date() - new Date(c.createdAt)) / 86400000 > 5)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)), [colis]);

  async function exportPaiementsExcel() {
    const XLSX = await loadXLSXLib();
    const wb = XLSX.utils.book_new();

    // Feuille 1 — tous les paiements encaissés
    const tousPaiements = colis.flatMap((c) => (c.paiements || []).map((p) => ({ ...p, tracking: c.tracking, destinataire: c.destinataire })));
    const headers1 = ["N° de suivi", "Destinataire", "Date", "Mode", "Montant saisi", "Devise", "Montant (EUR)", "Référence", "Enregistré par"];
    const rows1 = tousPaiements.map((p) => [p.tracking, p.destinataire, new Date(p.date).toLocaleString("fr-FR"), p.mode, p.montantSaisi, p.deviseSaisie, p.montant, p.reference || "—", p.par || "—"]);
    const ws1 = XLSX.utils.aoa_to_sheet([["BA-DIABY EXPRESS — Paiements encaissés"], [`Export généré le ${new Date().toLocaleDateString("fr-FR")}`], [], headers1, ...rows1]);
    ws1["!cols"] = headers1.map(() => ({ wch: 18 }));
    ws1["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: headers1.length - 1 } }];
    XLSX.utils.book_append_sheet(wb, ws1, "Paiements encaissés");

    // Feuille 2 — déclarations Mobile Money (Orange Money / MTN) faites par les clients
    const toutesDeclarations = colis.flatMap((c) => (c.declarationsPaiement || []).map((d) => ({ ...d, tracking: c.tracking, destinataire: c.destinataire })));
    const headers2 = ["N° de suivi", "Destinataire", "Date de déclaration", "Mode", "Montant", "Devise", "Référence", "Statut"];
    const rows2 = toutesDeclarations.map((d) => [d.tracking, d.destinataire, new Date(d.dateDeclaration).toLocaleString("fr-FR"), d.mode, d.montant, d.devise, d.reference, d.statut]);
    const ws2 = XLSX.utils.aoa_to_sheet([headers2, ...rows2]);
    ws2["!cols"] = headers2.map(() => ({ wch: 18 }));
    XLSX.utils.book_append_sheet(wb, ws2, "Déclarations Mobile Money");

    XLSX.writeFile(wb, `ba-diaby-express-paiements-${new Date().toISOString().slice(0, 10)}.xlsx`);
    notify?.("Export Excel téléchargé");
  }

  return (
    <div>
      <h1 style={{ fontFamily: "'Space Grotesk',sans-serif", color: "var(--text)", fontSize: 24, margin: "0 0 4px" }}>Paiements & Factures</h1>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 10, marginBottom: 22 }}>
        <p style={{ color: "var(--muted)", fontSize: 13.5, margin: 0 }}>Suivi des règlements et téléchargement des factures commerciales</p>
        <button onClick={exportPaiementsExcel} style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--surface)", color: "var(--text)", border: "1.5px solid var(--border)", borderRadius: 8, padding: "8px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}><Download size={14} /> Exporter (Excel)</button>
      </div>

      {declarationsEnAttente.length > 0 && (
        <div style={{ background: "var(--info-bg-alt)", border: "1px solid var(--info-border)", borderRadius: 12, padding: "12px 16px", marginBottom: 20 }}>
          <div style={{ fontSize: 12.5, color: "var(--info-fg)", fontWeight: 600, marginBottom: 6 }}>💳 {declarationsEnAttente.length} paiement{declarationsEnAttente.length > 1 ? "s" : ""} déclaré{declarationsEnAttente.length > 1 ? "s" : ""} par des clients, en attente de vérification</div>
          <div style={{ fontSize: 11.5, color: "var(--muted)" }}>Ouvrez le colis correspondant depuis la page Colis pour vérifier et confirmer : {declarationsEnAttente.map((c) => c.tracking).join(", ")}</div>
        </div>
      )}

      {impayesARelancer.length > 0 && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, marginBottom: 20, overflow: "hidden" }}>
          <button onClick={() => setShowRelances((s) => !s)} style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", background: "none", border: "none", padding: "16px 20px", cursor: "pointer" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <AlertTriangle size={16} color="#E23F52" />
              <span style={{ fontWeight: 700, color: "var(--text)", fontSize: 14 }}>{impayesARelancer.length} impayé{impayesARelancer.length > 1 ? "s" : ""} à relancer (plus de 5 jours)</span>
            </div>
            <ChevronRight size={16} color="var(--muted)" style={{ transform: showRelances ? "rotate(90deg)" : "none" }} />
          </button>
          {showRelances && (
            <div style={{ padding: "0 20px 16px" }}>
              {impayesARelancer.map((c) => {
                const jours = Math.floor((new Date() - new Date(c.createdAt)) / 86400000);
                const msg = `Bonjour ${c.destinataire}, votre colis Ba-Diaby Express (${c.tracking}) a un solde restant de ${fmt(c.reste, "EUR")}. Merci de régulariser dès que possible. Pour toute question, contactez-nous.`;
                return (
                  <div key={c.tracking} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderTop: "1px solid var(--surface2)", flexWrap: "wrap", gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{c.tracking} — {c.destinataire}</div>
                      <div style={{ fontSize: 11.5, color: "var(--muted)" }}>Reste {fmt(c.reste, "EUR")} · {jours} jours</div>
                    </div>
                    <a href={waLink(c.telephone, msg)} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 6, background: "#3ECB84", color: "#fff", borderRadius: 8, padding: "7px 12px", fontSize: 12, fontWeight: 700, textDecoration: "none" }}><MessageCircle size={13} /> Relancer sur WhatsApp</a>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
        <StatCard label="Chiffre d’affaires" value={fmt(totalCA, "EUR")} icon={DollarSign} tint="#0A2647" />
        <StatCard label="Total encaissé" value={fmt(totalEncaisse, "EUR")} icon={CheckCircle2} tint="#16A163" />
        <StatCard label="Reste à encaisser" value={fmt(totalReste, "EUR")} icon={Clock} tint="#E23F52" />
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {["tous", "solde", "partiel", "impaye"].map((f) => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: "7px 14px", borderRadius: 20, border: "1.5px solid " + (filter === f ? "var(--brand-solid)" : "var(--border)"),
            background: filter === f ? "var(--brand-solid)" : "var(--surface)", color: filter === f ? "#fff" : "var(--muted)", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
          }}>{f === "tous" ? "Tous" : labels[f]}</button>
        ))}
      </div>

      <div style={{ background: "var(--surface)", borderRadius: 14, boxShadow: "0 2px 10px rgba(10,38,71,0.06)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr style={{ background: "var(--surface2)", textAlign: "left" }}>{["N° de suivi", "Client", "Total", "Payé", "Reste", "Statut", ""].map((h) => <th key={h} style={{ padding: "12px 16px", fontSize: 11.5, color: "var(--muted)", fontWeight: 700 }}>{h}</th>)}</tr></thead>
          <tbody>
            {visibles.map((c) => (
              <tr key={c.tracking} style={{ borderTop: "1px solid var(--surface2)" }}>
                <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--text)", fontWeight: 600 }}>{c.tracking}</td>
                <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--muted)" }}>{c.destinataire}</td>
                <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--muted)" }}>{fmt(c.prix, "EUR")}</td>
                <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--muted)" }}>{fmt(c.paye, "EUR")}</td>
                <td style={{ padding: "12px 16px", fontSize: 13, color: c.reste > 0 ? "var(--danger-fg)" : "var(--muted)" }}>{fmt(c.reste, "EUR")}</td>
                <td style={{ padding: "12px 16px", fontSize: 12.5 }}><span style={{ background: colors[c.payStatus].bg, color: colors[c.payStatus].fg, padding: "3px 10px", borderRadius: 20, fontWeight: 700 }}>{labels[c.payStatus]}</span></td>
                <td style={{ padding: "12px 16px", textAlign: "right" }}>
                  <button onClick={() => downloadInvoice(c, data).catch((e) => { console.error(e); notify?.("Échec de génération du PDF — réessayez"); })} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", color: "var(--text)", cursor: "pointer", fontSize: 12.5 }}><Download size={13} /> PDF</button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={7} style={{ padding: 20, color: "var(--muted)", fontSize: 13 }}>Aucun colis dans cette catégorie.</td></tr>}
          </tbody>
        </table>
        {filtered.length > visibles.length && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, padding: "14px 16px", borderTop: "1px solid var(--border)", flexWrap: "wrap" }}>
            <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{visibles.length} affichés sur {filtered.length}</span>
            <button onClick={() => setNbAffiches((n) => n + TAILLE_PAGE)} style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: 8, padding: "7px 16px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
              Afficher {Math.min(TAILLE_PAGE, filtered.length - visibles.length)} de plus
            </button>
            <button onClick={() => setNbAffiches(filtered.length)} style={{ background: "none", border: "none", color: "var(--info-fg)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
              Tout afficher
            </button>
          </div>
        )}
      </div>
    </div>
  );
}


PaiementsPage = memo(PaiementsPage);
function ComptabilitePage({ data, persist, session, notify }) {
  const [periode, setPeriode] = useState("mois");
  const [form, setForm] = useState(null);
  const depenses = data.depenses || [];

  const {
    colisPeriode, recettes, facture, depensesPeriode, totalDepenses, totalSalaires, commissionsManuelles,
    commissionsAuto, gnfRate, totalCommissions, commissionsParAgence, partenaires, commissionsParPartenaire,
    benefice, resteAEncaisser, totalIndemnites, litigesOuverts, parMode, joursTries, paiementsPeriode,
  } = useMemo(() => {
    const now = new Date();
    const inPeriod = (dateStr) => {
      const d = new Date(dateStr);
      if (periode === "jour") return d.toDateString() === now.toDateString();
      if (periode === "semaine") { const start = new Date(now); start.setDate(now.getDate() - now.getDay()); return d >= start; }
      if (periode === "mois") return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      return true;
    };

    const colisPeriode = data.colis.filter((c) => c.status !== "Annulé" && inPeriod(c.createdAt));
    const recettes = colisPeriode.reduce((s, c) => s + c.paye, 0); // encaissé réel, EUR-équivalent
    const facture = colisPeriode.reduce((s, c) => s + c.prix, 0); // facturé (créances comprises), EUR-équivalent
    const depensesPeriode = depenses.filter((d) => inPeriod(d.date));
    const totalDepenses = depensesPeriode.filter((d) => d.type === "Dépense").reduce((s, d) => s + d.montant, 0); // en GNF (saisie manuelle)
    const totalSalaires = depensesPeriode.filter((d) => d.type === "Salaire").reduce((s, d) => s + d.montant, 0); // en GNF
    const commissionsManuelles = depensesPeriode.filter((d) => d.type === "Commission").reduce((s, d) => s + d.montant, 0); // en GNF
    const commissionsAuto = colisPeriode.reduce((s, c) => s + calcCommission(c, data.commissionConfig, data.categories), 0); // EUR-équivalent (taux en €)
    const gnfRate = LIVE_RATES.GNF || CURRENCIES.GNF;
    const totalCommissions = commissionsAuto + commissionsManuelles / gnfRate;
    const commissionsParAgence = sitesLocaux(data.sites).map((s) => ({
      nom: s.nom,
      montant: colisPeriode.filter((c) => (c.site || "Bambeto") === s.nom).reduce((sum, c) => sum + calcCommission(c, data.commissionConfig, data.categories), 0),
    }));
    const partenaires = (data.users || []).filter((u) => u.role === "Partenaire");
    const commissionsParPartenaire = partenaires.map((p) => ({
      nom: `${p.prenom} ${p.nom}`,
      montant: colisPeriode.filter((c) => c.partenaireId === p.id).reduce((sum, c) => sum + calcCommission(c, data.commissionConfig, data.categories), 0),
    }));
    // Résultat calculé sur une base COHÉRENTE : le chiffre d’affaires facturé de la période
    // est comparé aux charges de cette même période. Auparavant on soustrayait les commissions
    // dues sur TOUS les colis créés au seul argent déjà encaissé — ce qui affichait une perte
    // artificielle dès qu’un colis restait impayé. L’encaissement est suivi séparément.
    // Indemnités versées aux clients pour des colis perdus ou endommagés : ce sont de vraies
    // sorties d'argent, distinctes des dépenses courantes pour rester lisibles.
    const totalIndemnites = colisPeriode.reduce((sum, c) =>
      sum + ((c.litige && c.litige.statut === "Résolu" && c.litige.indemnite) ? Number(c.litige.indemnite) : 0), 0);
    const litigesOuverts = colisPeriode.filter((c) => c.litige && c.litige.statut === "Ouvert").length;
    const benefice = facture - (totalDepenses / gnfRate) - (totalSalaires / gnfRate) - totalCommissions - totalIndemnites;
    const resteAEncaisser = facture - recettes;

    // Encaissements réels (date du paiement, pas de la création du colis), par mode et par jour
    const tousPaiements = data.colis.flatMap((c) => (c.paiements || []).map((p) => ({ ...p, tracking: c.tracking, site: c.site || "Bambeto" })));
    const paiementsPeriode = tousPaiements.filter((p) => inPeriod(p.date));
    const parMode = {};
    paiementsPeriode.forEach((p) => { parMode[p.mode] = (parMode[p.mode] || 0) + p.montant; });
    const parJour = {};
    paiementsPeriode.forEach((p) => { const j = new Date(p.date).toLocaleDateString("fr-FR"); parJour[j] = (parJour[j] || 0) + p.montant; });
    const joursTries = Object.entries(parJour).sort((a, b) => new Date(b[0].split("/").reverse().join("-")) - new Date(a[0].split("/").reverse().join("-")));

    return {
      colisPeriode, recettes, facture, depensesPeriode, totalDepenses, totalSalaires, commissionsManuelles,
      commissionsAuto, gnfRate, totalCommissions, commissionsParAgence, partenaires, commissionsParPartenaire,
      benefice, resteAEncaisser, totalIndemnites, litigesOuverts, parMode, joursTries, paiementsPeriode,
    };
  }, [data.colis, depenses, data.sites, data.users, data.commissionConfig, data.categories, periode]);

  function addDepense() {
    if (!form.nom.trim() || !form.montant) return;
    const entry = { id: `dep${Date.now()}`, type: form.type, nom: form.nom.trim(), montant: Number(form.montant) || 0, date: form.date || new Date().toISOString() };
    persist({ ...data, depenses: [entry, ...depenses], activityLog: pushActivity(data, session, `${form.type} ajouté${form.type === "Dépense" ? "e" : ""}`, `${entry.nom} — ${fmtGNF(entry.montant)}`) });
    notify?.(`${form.type} enregistré${form.type === "Dépense" ? "e" : ""}`);
    setForm(null);
  }
  const [depenseASupprimer, setDepenseASupprimer] = useState(null);

  function removeDepense(id) {
    persist({ ...data, depenses: depenses.filter((d) => d.id !== id) });
  }

  const confirmationDepense = depenseASupprimer && (
    <ConfirmerAction
      titre="Supprimer cette dépense ?"
      message={`« ${depenseASupprimer.nom || "Dépense"} » sera retirée de la comptabilité.`}
      consequence="Le résultat de la période sera recalculé sans elle. Cette écriture ne peut pas être récupérée."
      onConfirmer={() => { removeDepense(depenseASupprimer.id); setDepenseASupprimer(null); }}
      onAnnuler={() => setDepenseASupprimer(null)}
    />
  );
  function exportRapport() {
    const headers = ["Type", "Nom", "Montant_GNF", "Date"];
    const rows = depensesPeriode.map((d) => [d.type, d.nom, d.montant, new Date(d.date).toLocaleDateString("fr-FR")]);
    rows.push(["Recette", "Total encaissé (période)", recettes, ""]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `rapport-financier-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const [pdfState, setPdfState] = useState("idle");
  const periodeLabels = { jour: "Aujourd’hui", semaine: "Cette semaine", mois: "Ce mois-ci", tout: "Depuis le début" };
  async function exportRapportPDF() {
    setPdfState("loading");
    try {
      const jspdf = await loadJsPDF();
      const doc = preparerDocPdf(new jspdf.jsPDF());
      const INK = [26, 30, 38], MUTED = [122, 130, 142], RED = [214, 39, 63];
      let y = 20;
      doc.addImage(DEFAULT_LOGO, "PNG", 14, y - 6, 16, 16);
      doc.setFont(undefined, "bold"); doc.setFontSize(16); doc.setTextColor(...INK);
      doc.text("BA-DIABY EXPRESS", 34, y);
      doc.setFont(undefined, "normal"); doc.setFontSize(10); doc.setTextColor(...MUTED);
      doc.text(`Récapitulatif financier — ${periodeLabels[periode]}`, 34, y + 6);
      y += 20;
      doc.setDrawColor(...RED); doc.setLineWidth(0.6); doc.line(14, y, 196, y);
      y += 10;

      const kpis = [
        ["Colis enregistrés", `${colisPeriode.length}`],
        ["Chiffre d’affaires facturé", fmt(facture, "EUR")],
        ["Recettes encaissées", fmt(recettes, "EUR")],
        ["Reste à encaisser", fmt(facture - recettes, "EUR")],
        ["Dépenses", fmtGNF(totalDepenses)],
        ["Salaires", fmtGNF(totalSalaires)],
        ["Commissions", fmt(totalCommissions, "EUR")],
        ["Résultat de la période (sur le facturé)", fmt(benefice, "EUR")],
        ["Reste à encaisser", fmt(resteAEncaisser, "EUR")],
        ["Indemnités de litige", fmt(totalIndemnites, "EUR")],
      ];
      const hasAutoTable = await ensureAutoTable();
      if (hasAutoTable && doc.autoTable) {
        doc.autoTable({ startY: y, body: kpis, theme: "plain", styles: { fontSize: 11, cellPadding: 3 }, columnStyles: { 0: { fontStyle: "bold", textColor: INK }, 1: { halign: "right", textColor: INK } }, margin: { left: 14, right: 14 } });
        y = doc.lastAutoTable.finalY + 12;
      }

      doc.setFont(undefined, "bold"); doc.setFontSize(11); doc.setTextColor(...INK);
      doc.text("Détail des colis de la période", 14, y);
      y += 4;
      const rows = colisPeriode.map((c) => [c.tracking, c.destinataire, routeLabel(c.pays, c.direction), fmt(c.prix, "EUR"), c.reste > 0 ? fmt(c.reste, "EUR") : "Payé"]);
      if (hasAutoTable && doc.autoTable && rows.length > 0) {
        doc.autoTable({
          startY: y + 4, head: [["N° de suivi", "Destinataire", "Route", "Montant", "Solde"]], body: rows,
          theme: "grid", headStyles: { fillColor: [10, 38, 71], textColor: 255, fontSize: 8.5 }, styles: { fontSize: 8.5, textColor: [40, 40, 40] },
          margin: { left: 14, right: 14 },
        });
      } else if (rows.length === 0) {
        doc.setFont(undefined, "normal"); doc.setFontSize(9); doc.setTextColor(...MUTED);
        doc.text("Aucun colis sur cette période.", 14, y + 8);
      }

      doc.setFontSize(7.3); doc.setTextColor(...MUTED); doc.setFont(undefined, "normal");
      doc.text(`Généré le ${new Date().toLocaleDateString("fr-FR")} — Ba-Diaby Express`, 14, 290);
      openPdf(doc, `recapitulatif-${periode}-${new Date().toISOString().slice(0, 10)}.pdf`);
      setPdfState("idle");
    } catch (e) {
      console.error("Échec de génération du récapitulatif PDF", e);
      setPdfState("error");
    }
  }

  return (
    <div>
      {confirmationDepense}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
        <div>
          <h1 style={{ fontFamily: "'Space Grotesk',sans-serif", color: "var(--text)", fontSize: 24, margin: 0 }}>Comptabilité</h1>
          <p style={{ color: "var(--muted)", fontSize: 13.5, margin: "4px 0 0" }}>Recettes, dépenses, salaires, commissions et bénéfices</p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={exportRapport} style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--surface)", color: "var(--text)", border: "1.5px solid var(--border)", borderRadius: 8, padding: "9px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}><Download size={14} /> Rapport CSV</button>
          <button onClick={exportRapportPDF} disabled={pdfState === "loading"} style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--surface)", color: "var(--text)", border: "1.5px solid var(--border)", borderRadius: 8, padding: "9px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}><FileStack size={14} /> {pdfState === "loading" ? "Génération…" : "Récapitulatif PDF"}</button>
          {pdfState === "error" && <span style={{ fontSize: 11, color: "var(--danger-fg)", alignSelf: "center" }}>Échec — réessayez</span>}
          {effectivePermission(session, "compta.gerer_depenses") && <button onClick={() => setForm({ type: "Dépense", nom: "", montant: "", date: new Date().toISOString().slice(0,10) })} style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--brand-solid)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}><Plus size={14} /> Ajouter</button>}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        {[["jour", "Aujourd’hui"], ["semaine", "Cette semaine"], ["mois", "Ce mois"], ["tout", "Tout"]].map(([k, label]) => (
          <button key={k} onClick={() => setPeriode(k)} style={{ padding: "7px 14px", borderRadius: 20, border: "1.5px solid " + (periode === k ? "var(--brand-solid)" : "var(--border)"), background: periode === k ? "var(--brand-solid)" : "var(--surface)", color: periode === k ? "#fff" : "var(--muted)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>{label}</button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
        <StatCard label="Recettes encaissées" value={fmt(recettes, "EUR")} icon={CheckCircle2} tint="#16A163" trend={`Facturé : ${fmt(facture, "EUR")}`} trendColor="var(--muted)" />
        <StatCard label="Dépenses" value={fmtGNF(totalDepenses)} icon={Receipt} tint="#E23F52" />
        <StatCard label="Salaires" value={fmtGNF(totalSalaires)} icon={Users} tint="#B8801C" />
        <StatCard label="Commissions" value={fmt(totalCommissions, "EUR")} icon={DollarSign} tint="#8B5CF6" trend={`dont auto : ${fmt(commissionsAuto, "EUR")}`} trendColor="var(--muted)" />
      </div>

      <div style={{ background: benefice >= 0 ? "var(--ok-bg)" : "var(--danger-bg)", borderRadius: 14, padding: 20, marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 13, color: "var(--text)", fontWeight: 700 }}>Résultat de la période</div>
          <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 3 }}>Sur le chiffre d’affaires facturé, charges, commissions{totalIndemnites > 0.005 ? " et indemnités de litige" : ""} déduites{resteAEncaisser > 0.005 ? ` · ${fmt(resteAEncaisser, "EUR")} encore à encaisser` : ""}</div>
        </div>
        <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 22, fontWeight: 700, color: benefice >= 0 ? "var(--ok-fg)" : "var(--danger-fg)" }}>{fmt(benefice, "EUR")}</div>
      </div>

      {paiementsPeriode.length > 0 && (
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 20 }}>
          <div style={{ background: "var(--surface)", borderRadius: 14, padding: 20, border: "1px solid var(--border)", flex: 1, minWidth: 260 }}>
            <div style={{ fontWeight: 700, color: "var(--text)", fontSize: 14, marginBottom: 12 }}>Encaissements par mode de paiement</div>
            {Object.entries(parMode).sort((a, b) => b[1] - a[1]).map(([mode, montant]) => (
              <div key={mode} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: "1px solid var(--border)" }}>
                <span style={{ fontSize: 13, color: "var(--text)" }}>{mode}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ok-fg)" }}>{fmt(montant, "EUR")}</span>
              </div>
            ))}
          </div>
          <div style={{ background: "var(--surface)", borderRadius: 14, padding: 20, border: "1px solid var(--border)", flex: 1, minWidth: 260, maxHeight: 260, overflowY: "auto" }}>
            <div style={{ fontWeight: 700, color: "var(--text)", fontSize: 14, marginBottom: 12 }}>Encaissements par jour</div>
            {joursTries.map(([jour, montant]) => (
              <div key={jour} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: "1px solid var(--border)" }}>
                <span style={{ fontSize: 13, color: "var(--text)" }}>{jour}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ok-fg)" }}>{fmt(montant, "EUR")}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {commissionsParAgence.length > 0 && (
        <div style={{ background: "var(--surface)", borderRadius: 14, padding: 20, border: "1px solid var(--border)", marginBottom: 20 }}>
          <div style={{ fontWeight: 700, color: "var(--text)", fontSize: 14, marginBottom: 4 }}>Commissions automatiques par agence</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 14 }}>Calculées selon les taux définis dans Configuration → Commissions par Agence.</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12 }}>
            {commissionsParAgence.map((a) => (
              <div key={a.nom} style={{ background: "var(--surface2)", borderRadius: 12, padding: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{a.nom}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "var(--ok-fg)", fontFamily: "'Space Grotesk',sans-serif", marginTop: 4 }}>{fmt(a.montant, "EUR")}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {commissionsParPartenaire.length > 0 && (
        <div style={{ background: "var(--surface)", borderRadius: 14, padding: 20, border: "1px solid var(--border)", marginBottom: 20 }}>
          <div style={{ fontWeight: 700, color: "var(--text)", fontSize: 14, marginBottom: 4 }}>Commissions par partenaire</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 14 }}>Basées sur les colis rattachés à chaque partenaire lors de leur enregistrement.</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12 }}>
            {commissionsParPartenaire.map((p) => (
              <div key={p.nom} style={{ background: "var(--surface2)", borderRadius: 12, padding: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{p.nom}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#8B5CF6", fontFamily: "'Space Grotesk',sans-serif", marginTop: 4 }}>{fmt(p.montant, "EUR")}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ background: "var(--surface)", borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr style={{ background: "var(--surface2)", textAlign: "left" }}>{["Type", "Libellé", "Montant", "Date", ""].map((h) => <th key={h} style={{ padding: "12px 16px", fontSize: 11.5, color: "var(--muted)", fontWeight: 700 }}>{h}</th>)}</tr></thead>
          <tbody>
            {depensesPeriode.map((d) => (
              <tr key={d.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{ padding: "12px 16px", fontSize: 12.5 }}><span style={{ background: "var(--surface2)", color: "var(--text)", padding: "3px 10px", borderRadius: 20, fontWeight: 600 }}>{d.type}</span></td>
                <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--text)" }}>{d.nom}</td>
                <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--muted)" }}>{fmtGNF(d.montant)}</td>
                <td style={{ padding: "12px 16px", fontSize: 12.5, color: "var(--muted)" }}>{new Date(d.date).toLocaleDateString("fr-FR")}</td>
                <td style={{ padding: "12px 16px", textAlign: "right" }}>{effectivePermission(session, "compta.gerer_depenses") && <button onClick={() => setDepenseASupprimer(d)} style={{ background: "none", border: "none", color: "var(--danger-fg)", cursor: "pointer" }}><Trash2 size={14} /></button>}</td>
              </tr>
            ))}
            {depensesPeriode.length === 0 && <tr><td colSpan={5} style={{ padding: 20, color: "var(--muted)", fontSize: 13 }}>Aucune dépense, salaire ou commission sur cette période.</td></tr>}
          </tbody>
        </table>
      </div>

      {form && (
        <Modal onClose={() => setForm(null)} title="Ajouter une écriture">
          <Field label="Type">
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} style={inputStyle}>
              <option value="Dépense">Dépense</option>
              <option value="Salaire">Salaire</option>
              <option value="Commission">Commission</option>
            </select>
          </Field>
          <Field label="Libellé"><input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} style={inputStyle} placeholder="ex: Carburant, Salaire Ibrahima, Commission agent Paris" /></Field>
          <Field label="Montant (GNF)"><input value={form.montant} onChange={(e) => setForm({ ...form, montant: e.target.value })} style={inputStyle} /></Field>
          <Field label="Date"><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} style={inputStyle} /></Field>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
            <button onClick={() => setForm(null)} style={{ padding: "9px 16px", borderRadius: 8, border: "1.5px solid var(--border)", background: "var(--surface2)", color: "var(--muted)", fontSize: 13, cursor: "pointer" }}>Annuler</button>
            <button onClick={addDepense} style={{ padding: "9px 16px", borderRadius: 8, border: "none", background: "var(--brand-solid)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Enregistrer</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

async function callClaude(prompt) {
  const response = await fetch("/api/claude", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1000, messages: [{ role: "user", content: prompt }] }),
  });
  const data = await response.json();
  return (data.content || []).map((b) => b.text || "").join("\n");
}

const IMPORT_TEMPLATE_HEADERS = [
  "Expediteur", "Expediteur Telephone", "Destinataire", "Destinataire Telephone",
  "Destinataire Adresse", "Pays Destination (code)", "Poids (kg)", "Produit", "Prix EUR (optionnel)",
];

async function downloadImportTemplate() {
  const XLSX = await loadXLSXLib();
  const exemple = ["Mamadou Diallo", "+224620000000", "Ibrahima Bah", "+33612345678", "12 Rue de Paris", "FR", "5", "Vêtements", ""];
  const ws = XLSX.utils.aoa_to_sheet([IMPORT_TEMPLATE_HEADERS, exemple]);
  ws["!cols"] = IMPORT_TEMPLATE_HEADERS.map(() => ({ wch: 20 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Colis à importer");
  XLSX.writeFile(wb, "modele-import-colis.xlsx");
}

/**
 * Outil pour l’agent : recherche un compte client par nom, affiche ses colis disponibles
 * (statut "Arrivé", prêts à être récupérés), l’agent en sélectionne un ou plusieurs, le
 * tarif dégressif au kg s’applique automatiquement selon le poids total du lot sélectionné.
 */

ComptabilitePage = memo(ComptabilitePage);
function ReceptionBordereauModal({ onClose, data, persist, notify, session }) {
  const [recherche, setRecherche] = useState("");
  const [compte, setCompte] = useState(null);
  const [selection, setSelection] = useState([]);
  const [generation, setGeneration] = useState(false);
  const [showAjout, setShowAjout] = useState(false);
  const [refColis, setRefColis] = useState("");
  const [poidsAjout, setPoidsAjout] = useState("");
  const [articlesAjout, setArticlesAjout] = useState("1");
  const tarifs = data.receptionTarifs || { paliers: [{ max: 10, tarif: 100000 }, { max: 40, tarif: 95000 }, { max: 100, tarif: 92000 }] };

  const comptesTrouves = recherche.trim().length >= 2
    ? (data.clientAccounts || []).filter((c) => pourRecherche(`${c.prenom} ${c.nom}`).includes(pourRecherche(recherche.trim())))
    : [];

  const colisDisponibles = compte ? data.colis.filter((c) => c.clientAccountId === compte.id && c.status === "Arrivé") : [];
  const colisSelectionnes = colisDisponibles.filter((c) => selection.includes(c.tracking));
  const poidsTotal = colisSelectionnes.reduce((s, c) => s + (Number(c.poids) || 0), 0);
  const { tauxParKg, total, palier } = calcReceptionFee(poidsTotal, tarifs);

  function toggle(tracking) {
    setSelection((s) => (s.includes(tracking) ? s.filter((t) => t !== tracking) : [...s, tracking]));
  }

  function enregistrerColisRecu() {
    const poids = Number(poidsAjout) || 0;
    if (poids <= 0) return;
    const tracking = genTracking((data.colis || []).map((c) => c.tracking));
    const tarification = calcReceptionFee(poids, data.receptionTarifs);
    const prixEUR = tarification.total / (LIVE_RATES.GNF || CURRENCIES.GNF);
    const nouveauColis = {
      tracking, expediteur: "Réception directe", expediteurTelephone: "", expediteurEmail: "", expediteurAdresse: "", expediteurPays: "GN",
      destinataire: `${compte.prenom} ${compte.nom}`, telephone: compte.telephone, destinataireEmail: compte.email || "", destinataireAdresse: compte.adresse || "", destinataireVille: "", destinataireCodePostal: "", destinatairePays: "GN",
      pays: "GN", direction: "import", mode: "air",
      produits: [{ id: `p${Date.now()}`, nom: refColis || "Colis reçu", quantite: String(Number(articlesAjout) || 1), poids: String(poids), categorie: "", personnalise: false, montant: "", devise: "GNF", typePrix: "unitaire" }],
      poids, volume: 0, valeurDeclaree: 0, site: "Bambeto",
      // Le prix est calculé dès l'enregistrement, à partir du poids et des paliers de réception.
      // Auparavant il restait à 0 : le client voyait « Reste à payer 0,00 » alors qu'il devait payer.
      prixBrut: prixEUR, discountLoyalty: 0, rabaisMontant: 0, rabaisDevise: "GNF", rabaisEUR: 0,
      prix: prixEUR, paye: 0, reste: prixEUR, photos: [],
      paiements: [], referenceCommande: refColis || null,
      notesInternes: `${refColis ? `Référence : ${refColis} · ` : ""}${poids} kg à ${fmtGNF(tarification.tauxParKg)}/kg`,
      clientAccountId: compte.id, provenance: null,
      // Le colis démarre à "Enregistré" (vu du client : « Reçu à l'entrepôt »). Il ne passera aux
      // étapes suivantes que sur action explicite d'un agent, via le bordereau.
      status: "Enregistré", historique: [{ status: "Enregistré", date: new Date().toISOString() }],
      agentCreation: session ? `${session.prenom} ${session.nom}`.trim() || session.identifiant : "",
      createdAt: new Date().toISOString(), pod: null, signature: null, driverLoc: null,
    };
    persist({ ...data, colis: [nouveauColis, ...data.colis], activityLog: pushActivity(data, session, "Colis reçu enregistré", `${tracking} — ${compte.prenom} ${compte.nom}`) });
    notify?.(`Colis ${tracking} — ${fmtGNF(tarification.total)} à payer`);
    setSelection((s) => [...s, tracking]);
    setRefColis(""); setPoidsAjout(""); setArticlesAjout("1"); setShowAjout(false);
  }

  async function generer() {
    setGeneration(true);
    try { await downloadReceptionBordereau(compte, colisSelectionnes, tarifs); }
    catch (e) { console.error(e); }
    setGeneration(false);
  }

  return (
    <Modal onClose={onClose} title="Bordereau de réception client" wide>
      {!compte ? (
        <>
          <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 14 }}>Recherchez le client dont les colis sont disponibles à la récupération.</div>
          <input value={recherche} onChange={(e) => setRecherche(e.target.value)} style={inputStyle} placeholder="Nom du client..." autoFocus />
          {comptesTrouves.length > 0 && (
            <div style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", marginTop: 10 }}>
              {comptesTrouves.map((c) => (
                <button key={c.id} onClick={() => setCompte(c)} style={{ display: "block", width: "100%", textAlign: "start", padding: "10px 14px", background: "var(--surface2)", border: "none", borderTop: "1px solid var(--border)", cursor: "pointer", fontSize: 13, color: "var(--text)" }}>
                  {c.prenom} {c.nom} <span style={{ color: "var(--muted)" }}>· {c.telephone}</span>
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{compte.prenom} {compte.nom}</div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>{compte.telephone}</div>
            </div>
            <button onClick={() => { setCompte(null); setSelection([]); setRecherche(""); }} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 12px", fontSize: 12, color: "var(--muted)", cursor: "pointer" }}>Changer de client</button>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)" }}>Colis disponibles ({colisDisponibles.length})</div>
            <button onClick={() => setShowAjout((s) => !s)} style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 12px", fontSize: 12, color: "var(--text)", cursor: "pointer" }}>
              {showAjout ? "Annuler" : "+ Enregistrer un colis reçu"}
            </button>
          </div>

          {showAjout && (
            <div style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 12, padding: 14, marginBottom: 16 }}>
              <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 10 }}>Pour un colis arrivé physiquement, identifié par le nom ou une référence inscrite dessus — pas besoin de repasser par le formulaire complet.</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10, marginBottom: 10 }}>
                <Field label="Référence sur le colis (optionnel)"><input value={refColis} onChange={(e) => setRefColis(e.target.value)} style={{ ...inputStyle, marginBottom: 0 }} placeholder="ex: SHEIN-XYZ" /></Field>
                <Field label="Nombre d’articles"><input type="number" min="1" value={articlesAjout} onChange={(e) => setArticlesAjout(e.target.value)} style={{ ...inputStyle, marginBottom: 0 }} /></Field>
                <Field label="Poids total (kg) *"><input type="number" step="0.1" value={poidsAjout} onChange={(e) => setPoidsAjout(e.target.value)} style={{ ...inputStyle, marginBottom: 0 }} placeholder="ex: 3.5" /></Field>
              </div>
              <button onClick={enregistrerColisRecu} disabled={!poidsAjout || Number(poidsAjout) <= 0} style={{ background: Number(poidsAjout) > 0 ? "#3D63FF" : "var(--surface)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 12.5, fontWeight: 700, cursor: Number(poidsAjout) > 0 ? "pointer" : "not-allowed" }}>Enregistrer et rattacher à {compte.prenom}</button>
            </div>
          )}

          {colisDisponibles.length === 0 ? (
            <div style={{ background: "var(--surface2)", borderRadius: 12, padding: 20, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>Aucun colis disponible (statut "Arrivé") pour ce client actuellement.</div>
          ) : (
            <>
              <div style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", marginBottom: 18 }}>
                {colisDisponibles.map((c) => (
                  <label key={c.tracking} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderTop: "1px solid var(--border)", cursor: "pointer" }}>
                    <input type="checkbox" checked={selection.includes(c.tracking)} onChange={() => toggle(c.tracking)} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12.5, color: "var(--text)", fontWeight: 600 }}>{c.tracking} — {c.destinataire}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>{c.expediteur === "Réception directe" ? "Enregistré directement à la réception" : routeLabel(c.pays, c.direction)}{c.notesInternes ? ` · ${c.notesInternes}` : ""}</div>
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--text)", fontWeight: 600 }}>{c.poids} kg</div>
                  </label>
                ))}
              </div>

              {selection.length > 0 && (
                <div style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 12, padding: 16, marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "var(--muted)", marginBottom: 6 }}>
                    <span>Poids total du lot</span><span style={{ color: "var(--text)", fontWeight: 600 }}>{poidsTotal.toFixed(1)} kg</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "var(--muted)", marginBottom: 10 }}>
                    <span>Tarif appliqué (palier jusqu’à {palier?.max} kg)</span>
                    <span style={{ color: "var(--text)", fontWeight: 600 }}>{tauxParKg.toLocaleString("fr-FR")} GNF/kg</span>
                  </div>
                  <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10, display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
                    <span>Total à payer</span><span>{total.toLocaleString("fr-FR")} GNF</span>
                  </div>
                </div>
              )}

              <button onClick={generer} disabled={selection.length === 0 || generation} style={{ width: "100%", background: selection.length ? "#3ECB84" : "var(--surface2)", color: selection.length ? "#0A2647" : "var(--muted)", border: "none", borderRadius: 8, padding: "12px 0", fontSize: 14, fontWeight: 700, cursor: selection.length ? "pointer" : "not-allowed" }}>
                {generation ? "Génération…" : `Générer le bordereau de réception (${selection.length} colis)`}
              </button>
            </>
          )}
        </>
      )}
    </Modal>
  );
}

function ImportExcelModal({ onClose, onImportMany, data, session }) {
  const [rows, setRows] = useState(null);
  const [fileErr, setFileErr] = useState("");
  const [importing, setImporting] = useState(false);
  const sitesGN = sitesLocaux(data?.sites);
  const [agence, setAgence] = useState(sitesGN[0]?.nom || "Bambeto");

  function getVal(row, ...keys) {
    for (const k of keys) {
      const foundKey = Object.keys(row).find((rk) => rk.trim().toLowerCase() === k.toLowerCase());
      if (foundKey && row[foundKey] !== undefined && row[foundKey] !== "") return String(row[foundKey]).trim();
    }
    return "";
  }

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setFileErr(""); setRows(null);
    try {
      const XLSX = await loadXLSXLib();
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      const parsed = json.map((row) => {
        const destPays = getVal(row, "Pays Destination (code)", "Pays Destination", "Pays").toUpperCase();
        const valid = COUNTRIES.some((c) => c.code === destPays);
        return {
          expediteur: getVal(row, "Expediteur", "Expéditeur"),
          expediteurTelephone: getVal(row, "Expediteur Telephone", "Expéditeur Téléphone"),
          destinataire: getVal(row, "Destinataire"),
          telephone: getVal(row, "Destinataire Telephone", "Destinataire Téléphone"),
          destinataireAdresse: getVal(row, "Destinataire Adresse"),
          destinatairePays: valid ? destPays : "",
          poids: Number(getVal(row, "Poids (kg)", "Poids")) || 0,
          produit: getVal(row, "Produit") || "Colis",
          prixEur: getVal(row, "Prix EUR (optionnel)", "Prix EUR") ? Number(getVal(row, "Prix EUR (optionnel)", "Prix EUR")) : null,
        };
      }).map((r) => ({ ...r, valide: !!(r.destinataire && r.telephone && r.destinatairePays && r.poids > 0) }));
      setRows(parsed);
    } catch (err) {
      console.error(err);
      setFileErr("Impossible de lire ce fichier. Vérifiez qu’il s’agit bien d’un fichier Excel (.xlsx) au bon format.");
    }
    e.target.value = "";
  }

  const validRows = (rows || []).filter((r) => r.valide);

  function importer() {
    setImporting(true);
    const existingTrackings = (data.colis || []).map((c) => c.tracking);
    const nouveaux = validRows.map((r) => {
      const direction = r.destinatairePays === "GN" ? "import" : "export";
      const pays = r.destinatairePays === "GN" ? "GN" : r.destinatairePays;
      const prixBrut = r.prixEur != null ? r.prixEur : calcPrice(pays, r.poids, 0, "air");
      const tracking = genTracking([...existingTrackings]);
      existingTrackings.push(tracking);
      return {
        tracking,
        expediteur: r.expediteur || "Expéditeur", expediteurTelephone: r.expediteurTelephone, expediteurEmail: "", expediteurAdresse: "", expediteurPays: "GN",
        destinataire: r.destinataire, telephone: r.telephone, destinataireEmail: "", destinataireAdresse: r.destinataireAdresse, destinataireVille: "", destinataireCodePostal: "", destinatairePays: r.destinatairePays,
        pays, direction, mode: "air",
        produits: [{ id: `p${Date.now()}${Math.random().toString(36).slice(2,5)}`, nom: r.produit, quantite: "1", poids: String(r.poids), categorie: "", personnalise: false, montant: "", devise: "GNF", typePrix: "unitaire" }],
        poids: r.poids, volume: 0, valeurDeclaree: 0, site: agence,
        prixBrut, discountLoyalty: 0, rabaisMontant: 0, rabaisDevise: "GNF", rabaisEUR: 0, prix: prixBrut, paye: 0, reste: prixBrut, photos: [],
        paiements: [], notesInternes: "",
        status: "Enregistré", historique: [{ status: "Enregistré", date: new Date().toISOString() }],
        agentCreation: session ? `${session.prenom} ${session.nom}`.trim() || session.identifiant : "",
        createdAt: new Date().toISOString(), pod: null, signature: null, driverLoc: null,
      };
    });
    onImportMany(nouveaux);
    setImporting(false);
    onClose();
  }

  return (
    <Modal onClose={onClose} title="Importer des colis depuis Excel" wide>
      <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 14 }}>
        Téléchargez le modèle, remplissez une ligne par colis, puis importez le fichier rempli. Les colonnes obligatoires sont Destinataire, Destinataire Téléphone, Pays Destination et Poids.
      </div>
      <button onClick={downloadImportTemplate} style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--surface2)", border: "1.5px solid var(--border)", borderRadius: 8, padding: "9px 16px", fontSize: 12.5, fontWeight: 700, color: "var(--text)", cursor: "pointer", marginBottom: 16 }}>
        <Download size={14} /> Télécharger le modèle Excel
      </button>

      <div style={{ marginBottom: 14 }}>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "var(--brand-solid)", color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          Choisir un fichier Excel (.xlsx)
          <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} style={{ display: "none" }} />
        </label>
      </div>
      {fileErr && <div style={{ color: "var(--danger-fg)", fontSize: 12.5, marginBottom: 12 }}>{fileErr}</div>}

      {rows && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 10 }}>{validRows.length} / {rows.length} lignes valides</div>
          <div style={{ background: "var(--surface2)", borderRadius: 12, border: "1px solid var(--border)", overflow: "hidden", marginBottom: 16, maxHeight: 260, overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr style={{ textAlign: "left" }}>{["", "Destinataire", "Téléphone", "Pays", "Poids", "Prix"].map((h) => <th key={h} style={{ padding: "8px 12px", fontSize: 10.5, color: "var(--muted)" }}>{h}</th>)}</tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "6px 12px" }}>{r.valide ? <CheckCircle2 size={13} color="var(--ok-fg)" /> : <AlertTriangle size={13} color="#E23F52" />}</td>
                    <td style={{ padding: "6px 12px", fontSize: 12 }}>{r.destinataire || "—"}</td>
                    <td style={{ padding: "6px 12px", fontSize: 12 }}>{r.telephone || "—"}</td>
                    <td style={{ padding: "6px 12px", fontSize: 12 }}>{r.destinatairePays || "—"}</td>
                    <td style={{ padding: "6px 12px", fontSize: 12 }}>{r.poids ? `${r.poids} kg` : "—"}</td>
                    <td style={{ padding: "6px 12px", fontSize: 12 }}>{r.prixEur != null ? fmt(r.prixEur, "EUR") : "auto"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Field label="Agence d’enregistrement"><select value={agence} onChange={(e) => setAgence(e.target.value)} style={inputStyle}>{(sitesGN.length > 0 ? sitesGN : [{ nom: "Bambeto" }]).map((s) => <option key={s.nom} value={s.nom}>{s.nom}</option>)}</select></Field>
          <button onClick={importer} disabled={validRows.length === 0 || importing} style={{ background: validRows.length ? "#3ECB84" : "var(--surface2)", color: validRows.length ? "#0A2647" : "var(--muted)", border: "none", borderRadius: 8, padding: "11px 22px", fontSize: 13.5, fontWeight: 700, cursor: validRows.length ? "pointer" : "not-allowed", marginTop: 8 }}>
            {importing ? "Import en cours…" : `Importer ${validRows.length} colis`}
          </button>
        </div>
      )}
    </Modal>
  );
}


function AiColisModal({ onClose, onCreate, data, session }) {
  const [texte, setTexte] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [extracted, setExtracted] = useState(null);

  async function analyser() {
    if (!texte.trim()) return;
    setLoading(true); setErr(""); setExtracted(null);
    const codesValides = COUNTRIES.map((c) => c.code).join(", ");
    const prompt = `Tu extrais les informations d’un colis à expédier depuis une phrase en français. Voici les codes pays valides (utilise EXACTEMENT un de ces codes, en devinant le plus probable si le pays est cité par son nom) : ${codesValides}. Guinée = GN.
Phrase : "${texte.replace(/"/g, "'")}"
Réponds UNIQUEMENT en JSON strict, sans texte autour, avec ces clés (mets null si une info manque) :
{"expediteur_prenom": "", "expediteur_nom": "", "expediteur_telephone": "", "destinataire_prenom": "", "destinataire_nom": "", "destinataire_telephone": "", "pays_expediteur": "", "pays_destinataire": "", "poids_kg": 0, "prix_eur": null, "produit_nom": ""}`;
    try {
      const text = await callClaude(prompt);
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setExtracted(parsed);
    } catch (e) {
      setErr("L’IA n’a pas pu analyser cette phrase. Réessayez en étant plus précis.");
    }
    setLoading(false);
  }

  function confirmer() {
    const expPays = COUNTRIES.some((c) => c.code === extracted.pays_expediteur) ? extracted.pays_expediteur : "GN";
    const destPays = COUNTRIES.some((c) => c.code === extracted.pays_destinataire) ? extracted.pays_destinataire : "FR";
    const direction = destPays === "GN" ? "import" : "export";
    const pays = destPays === "GN" ? expPays : destPays;
    const poids = Number(extracted.poids_kg) || 1;
    const prixBrut = extracted.prix_eur ? Number(extracted.prix_eur) : calcPrice(pays, poids, 0, "air");
    const produit = extracted.produit_nom || "Colis";
    onCreate({
      tracking: genTracking((data?.colis || []).map((c) => c.tracking)),
      expediteur: `${extracted.expediteur_prenom || ""} ${extracted.expediteur_nom || ""}`.trim() || "Expéditeur",
      expediteurTelephone: extracted.expediteur_telephone || "", expediteurEmail: "", expediteurAdresse: "", expediteurPays: expPays,
      destinataire: `${extracted.destinataire_prenom || ""} ${extracted.destinataire_nom || ""}`.trim() || "Destinataire",
      telephone: extracted.destinataire_telephone || "", destinataireEmail: "", destinataireAdresse: "", destinatairePays: destPays,
      pays, direction, mode: "air",
      produits: [{ id: `p${Date.now()}`, nom: produit, quantite: "1", poids: String(poids), categorie: "", personnalise: false, montant: "", devise: "GNF", typePrix: "unitaire" }],
      poids, volume: 0, valeurDeclaree: 0,
      prixBrut, discountLoyalty: 0, rabaisMontant: 0, rabaisDevise: "GNF", rabaisEUR: 0, prix: prixBrut, paye: 0, reste: prixBrut, photos: [],
      status: "Enregistré", historique: [{ status: "Enregistré", date: new Date().toISOString() }],
      agentCreation: session ? `${session.prenom} ${session.nom}`.trim() || session.identifiant : "",
      createdAt: new Date().toISOString(), pod: null, signature: null, driverLoc: null,
    });
    onClose();
  }

  return (
    <Modal onClose={onClose} title="Créer un colis par IA" wide>
      <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 14 }}>Décrivez le colis en une phrase, l’IA remplit le formulaire à votre place. Exemple : "Colis de Paris vers Conakry, expéditeur Mamadou Diallo au +33612345678, destinataire Ibrahima Bah au +224620000000, poids 12 kg, prix 120 euros."</div>
      <textarea value={texte} onChange={(e) => setTexte(e.target.value)} rows={4} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit", marginBottom: 12 }} placeholder="Créer un colis de Paris vers Conakry..." />
      <button onClick={analyser} disabled={loading || !texte.trim()} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", background: "#8B5CF6", color: "#fff", border: "none", borderRadius: 8, padding: "11px 0", fontSize: 13.5, fontWeight: 700, cursor: "pointer", marginBottom: 14 }}>
        {loading ? <RefreshCw size={15} /> : <Sparkles size={15} />} {loading ? "Analyse en cours…" : "Analyser la phrase"}
      </button>
      {err && <div style={{ color: "var(--danger-fg)", fontSize: 12.5, marginBottom: 12 }}>{err}</div>}

      {extracted && (
        <div style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 12, padding: 16, marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 10 }}>APERÇU — VÉRIFIEZ AVANT DE CONFIRMER</div>
          <Info label="Expéditeur" value={`${extracted.expediteur_prenom || "?"} ${extracted.expediteur_nom || ""} · ${extracted.expediteur_telephone || "non précisé"}`} />
          <div style={{ height: 10 }} />
          <Info label="Destinataire" value={`${extracted.destinataire_prenom || "?"} ${extracted.destinataire_nom || ""} · ${extracted.destinataire_telephone || "non précisé"}`} />
          <div style={{ height: 10 }} />
          <Info label="Route" value={`${FLAGS[extracted.pays_expediteur] || ""} ${extracted.pays_expediteur || "GN"} → ${FLAGS[extracted.pays_destinataire] || ""} ${extracted.pays_destinataire || "FR"}`} />
          <div style={{ height: 10 }} />
          <Info label="Poids / Produit" value={`${extracted.poids_kg || 1} kg · ${extracted.produit_nom || "Colis"}`} />
          <div style={{ height: 10 }} />
          <Info label="Prix" value={extracted.prix_eur ? fmt(Number(extracted.prix_eur), "EUR") : "Calculé automatiquement"} />
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <button onClick={onClose} style={{ padding: "10px 18px", borderRadius: 8, border: "1.5px solid var(--border)", background: "var(--surface)", color: "var(--muted)", fontSize: 13.5, cursor: "pointer" }}>Annuler</button>
        {extracted && <button onClick={confirmer} style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: "var(--brand-solid)", color: "#fff", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>Confirmer et enregistrer le colis</button>}
      </div>
    </Modal>
  );
}

function AiAssistant({ data }) {
  const [tab, setTab] = useState("route");
  const [pays, setPays] = useState("FR");
  const [mode, setMode] = useState("air");
  const [poids, setPoids] = useState("10");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");

  async function generate() {
    setLoading(true); setErr(""); setResult(null);
    const c = COUNTRIES.find((x) => x.code === pays);
    const histo = data.colis.filter((x) => x.pays === pays && x.mode === mode);
    const avgWeight = histo.length ? (histo.reduce((s, x) => s + x.poids, 0) / histo.length).toFixed(1) : "n/a";
    const contexte = data.miraKnowledge ? `\nInformations propres à l’entreprise à prendre en compte : ${data.miraKnowledge}\n` : "";
    const prompt = `Tu es l’assistant logistique de Ba-Diaby Express (transport Conakry-monde). Route: Conakry -> ${c.name} (${c.city}), mode: ${mode === "air" ? "aérien" : "maritime"}, poids du colis: ${poids} kg. Délai de référence historique: ${mode === "air" ? c.delayAir : c.delaySea} jours. Nombre de colis déjà expédiés sur cette route: ${histo.length}, poids moyen historique: ${avgWeight} kg.${contexte} Réponds UNIQUEMENT en JSON strict avec les clés: "delai_estime_jours" (nombre), "itineraire" (une phrase courte en français), "conseil_tarif" (une phrase courte en français), "prevision" (une phrase courte en français sur la tendance des coûts/délais). Pas de texte hors JSON.`;
    try {
      const text = await callClaude(prompt);
      const clean = text.replace(/```json|```/g, "").trim();
      setResult(JSON.parse(clean));
    } catch (e) { setErr("L’analyse IA n’a pas pu être générée. Réessayez."); }
    setLoading(false);
  }

  return (
    <div>
      <h1 style={{ fontFamily: "'Space Grotesk',sans-serif", color: "var(--text)", fontSize: 24, margin: "0 0 4px" }}>Assistant IA</h1>
      <p style={{ color: "var(--muted)", fontSize: 13.5, marginTop: 0, marginBottom: 18 }}>Estimation de route et questions sur votre activité, générées par IA à partir de vos données</p>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button onClick={() => setTab("route")} style={{ padding: "8px 16px", borderRadius: 20, border: "1.5px solid " + (tab === "route" ? "var(--brand-solid)" : "var(--border)"), background: tab === "route" ? "var(--brand-solid)" : "var(--surface)", color: tab === "route" ? "#fff" : "var(--muted)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>Estimation de route</button>
        <button onClick={() => setTab("qa")} style={{ padding: "8px 16px", borderRadius: 20, border: "1.5px solid " + (tab === "qa" ? "var(--brand-solid)" : "var(--border)"), background: tab === "qa" ? "var(--brand-solid)" : "var(--surface)", color: tab === "qa" ? "#fff" : "var(--muted)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>Poser une question</button>
      </div>

      {tab === "route" ? (
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div style={{ background: "var(--surface)", borderRadius: 14, padding: 22, width: "min(92vw, 320px)", boxShadow: "0 2px 10px rgba(10,38,71,0.06)" }}>
            <Field label="Destination"><select value={pays} onChange={(e) => setPays(e.target.value)} style={inputStyle}>{COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</select></Field>
            <Field label="Mode"><div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setMode("air")} style={{ ...toggleBtn, ...(mode === "air" ? toggleActive : {}) }}><Plane size={14} /> Aérien</button>
              <button disabled title="Voie maritime temporairement indisponible" style={{ ...toggleBtn, opacity: 0.4, cursor: "not-allowed" }}><Ship size={14} /> Maritime</button>
            </div></Field>
            <Field label="Poids (kg)"><input value={poids} onChange={(e) => setPoids(e.target.value)} style={inputStyle} /></Field>
            <button onClick={generate} disabled={loading} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "var(--brand-solid)", color: "#fff", border: "none", borderRadius: 8, padding: "11px 0", fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}>
              {loading ? <RefreshCw size={15} className="spin" /> : <Sparkles size={15} />} {loading ? "Analyse en cours…" : "Générer l’analyse IA"}
            </button>
          </div>
          <div style={{ flex: 1, minWidth: 280 }}>
            {err && <div style={{ color: "var(--danger-fg)", fontSize: 13 }}>{err}</div>}
            {result && (
              <div style={{ display: "grid", gap: 14 }}>
                <div style={{ background: "#0A2647", borderRadius: 14, padding: 20, color: "#fff" }}>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>Délai estimé</div>
                  <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 28, fontWeight: 700 }}>{result.delai_estime_jours} jours</div>
                </div>
                <AiCard title="Meilleur itinéraire" text={result.itineraire} />
                <AiCard title="Suggestion tarifaire" text={result.conseil_tarif} />
                <AiCard title="Prévision" text={result.prevision} />
              </div>
            )}
            {!result && !loading && !err && <div style={{ color: "var(--muted)", fontSize: 13 }}>Renseignez les paramètres puis lancez l’analyse.</div>}
          </div>
        </div>
      ) : (
        <AiQaPanel data={data} />
      )}
    </div>
  );
}

function AiQaPanel({ data }) {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState(null);
  const [err, setErr] = useState("");
  const suggestions = [
    "Combien de colis sont en transit ?",
    "Quels clients n’ont pas payé ?",
    "Quel est le chiffre d’affaires du jour ?",
    "Combien de kilos ont été expédiés cette semaine ?",
  ];

  async function poser(q) {
    const question2 = q || question;
    if (!question2.trim()) return;
    setLoading(true); setErr(""); setAnswer(null);
    const now = new Date();
    const debutSemaine = new Date(now); debutSemaine.setDate(now.getDate() - now.getDay());
    const debutJour = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const colisResume = data.colis.map((c) => ({
      tracking: c.tracking, statut: c.status, destinataire: c.destinataire, poids: c.poids,
      prix_eur: c.prix, paye_eur: c.paye, reste_eur: c.reste, pays: c.pays, cree_le: c.createdAt,
    }));
    const prompt = `Tu es l’assistant de gestion de Ba-Diaby Express. Voici les données actuelles de l’entreprise au format JSON (statuts possibles : ${STATUSES.join(", ")}, Annulé) :
${JSON.stringify(colisResume).slice(0, 12000)}
Date du jour : ${now.toISOString()}. Début de semaine (dimanche) : ${debutSemaine.toISOString()}.
Question de l’utilisateur : "${question2}"
Réponds en français, de façon concise (2-4 phrases maximum), en te basant UNIQUEMENT sur les données fournies. Si l’information demandée n’est pas calculable à partir des données, dis-le clairement.`;
    try {
      const text = await callClaude(prompt);
      setAnswer(text.trim());
    } catch (e) { setErr("La question n’a pas pu être traitée. Réessayez."); }
    setLoading(false);
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <input value={question} onChange={(e) => setQuestion(e.target.value)} onKeyDown={(e) => e.key === "Enter" && poser()} style={{ ...inputStyle, flex: 1 }} placeholder="Posez une question sur votre activité..." />
        <button onClick={() => poser()} disabled={loading || !question.trim()} style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--brand-solid)", color: "#fff", border: "none", borderRadius: 8, padding: "0 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          {loading ? <RefreshCw size={15} /> : <Sparkles size={15} />}
        </button>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
        {suggestions.map((s) => (
          <button key={s} onClick={() => { setQuestion(s); poser(s); }} style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 20, padding: "6px 12px", fontSize: 11.5, color: "var(--muted)", cursor: "pointer" }}>{s}</button>
        ))}
      </div>
      {err && <div style={{ color: "var(--danger-fg)", fontSize: 13, marginBottom: 12 }}>{err}</div>}
      {loading && <div style={{ color: "var(--muted)", fontSize: 13 }}>Analyse des données en cours…</div>}
      {answer && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 18, display: "flex", gap: 12 }}>
          <Sparkles size={18} color="#8B5CF6" style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: 13.5, color: "var(--text)", lineHeight: 1.6 }}>{answer}</div>
        </div>
      )}
    </div>
  );
}
function AiCard({ title, text }) {
  return <div style={{ background: "var(--surface)", borderRadius: 12, padding: "14px 18px", boxShadow: "0 2px 10px rgba(10,38,71,0.06)" }}><div style={{ fontSize: 12, fontWeight: 700, color: "var(--danger-fg)", marginBottom: 4 }}>{title}</div><div style={{ fontSize: 13.5, color: "var(--text)" }}>{text}</div></div>;
}

function SiteVitrinePage({ data, persist, notify, onBack }) {
  const site = data.siteVitrine || {};
  const [nomPublic, setNomPublic] = useState(site.nomPublic || "Ba-Diaby Express");
  const [tagline, setTagline] = useState(site.tagline || "La Ponte entre la France et la Guinée");
  const [domaine, setDomaine] = useState(site.domaine || "");
  const [trackingPublic, setTrackingPublic] = useState(site.trackingPublic ?? true);
  const [departures, setDepartures] = useState(data.departures || {});

  function save() {
    persist({ ...data, siteVitrine: { nomPublic, tagline, domaine, trackingPublic }, departures });
    notify?.("Site vitrine mis à jour");
  }
  function updateDeparture(code, patch) {
    setDepartures((d) => ({ ...d, [code]: { ...d[code], ...patch } }));
  }

  return (
    <div>
      <ConfigPageHeader title="Site Vitrine Public" desc="Personnalisez votre page d’accueil, activez le tracking public et annoncez vos prochains départs." onBack={onBack} />
      <div style={{ background: "var(--surface)", borderRadius: 14, padding: 22, maxWidth: 460, border: "1px solid var(--border)", marginBottom: 20 }}>
        <Field label="Nom affiché au public"><input value={nomPublic} onChange={(e) => setNomPublic(e.target.value)} style={inputStyle} /></Field>
        <Field label="Slogan"><input value={tagline} onChange={(e) => setTagline(e.target.value)} style={inputStyle} /></Field>
        <Field label="Nom de domaine personnalisé (optionnel)"><input value={domaine} onChange={(e) => setDomaine(e.target.value)} style={inputStyle} placeholder="www.badiaby-express.com" /></Field>
        <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, cursor: "pointer" }}>
          <input type="checkbox" checked={trackingPublic} onChange={(e) => setTrackingPublic(e.target.checked)} />
          <div><div style={{ fontSize: 13, color: "var(--text)", fontWeight: 600 }}>Suivi public activé</div><div style={{ fontSize: 11.5, color: "var(--muted)" }}>Les clients peuvent suivre leur colis sans se connecter</div></div>
        </label>
      </div>

      <div style={{ background: "var(--surface)", borderRadius: 14, padding: 22, maxWidth: 620, border: "1px solid var(--border)", marginBottom: 20 }}>
        <div style={{ fontWeight: 700, color: "var(--text)", fontSize: 14, marginBottom: 4 }}>Prochains départs par destination</div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16 }}>Affiché sur la page d’accueil publique quand un visiteur clique sur le drapeau d’un pays.</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {COUNTRIES.filter((c) => c.code !== "GN").map((c) => {
            const dep = departures[c.code] || {};
            return (
              <div key={c.code} style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--surface2)", borderRadius: 12, padding: "10px 12px", flexWrap: "wrap" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", width: 130, flexShrink: 0 }}>{FLAGS[c.code]} {c.name}</div>
                <input type="date" value={dep.prochaine || ""} onChange={(e) => updateDeparture(c.code, { prochaine: e.target.value })} style={{ ...inputStyle, width: 150, marginBottom: 0 }} />
                <input value={dep.frequence || ""} onChange={(e) => updateDeparture(c.code, { frequence: e.target.value })} placeholder="ex: Tous les mardis et vendredis" style={{ ...inputStyle, flex: 1, minWidth: 180, marginBottom: 0 }} />
              </div>
            );
          })}
        </div>
      </div>

      <button onClick={save} style={{ background: "#3D63FF", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Enregistrer</button>
    </div>
  );
}

/**
 * Réglages des notifications WhatsApp : quel événement prévient qui.
 * Un tableau simple — une ligne par événement, une colonne par destinataire.
 */
/** Gestion du calendrier des départs — ce que les clients verront annoncé. */
function DepartsPage({ data, persist, notify, onBack }) {
  const [departs, setDeparts] = useState(data.departs || []);
  const modifie = JSON.stringify(departs) !== JSON.stringify(data.departs || []);

  function ajouter() {
    const dans7j = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    const dans5j = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
    setDeparts((d) => [...d, { id: `dep${Date.now()}`, pays: "FR", mode: "air", dateDepart: dans7j, dateLimite: dans5j, note: "" }]);
  }
  function majDepart(i, cle, valeur) {
    setDeparts((d) => d.map((x, k) => (k === i ? { ...x, [cle]: valeur } : x)));
  }

  const passes = (departs || []).filter((d) => d.dateLimite && new Date(d.dateLimite).getTime() < Date.now()).length;

  return (
    <div>
      <ConfigPageHeader title="Calendrier des départs" desc="Annoncez à vos clients quand part le prochain envoi. Ils cessent de vous appeler pour le demander." onBack={onBack} />

      <div style={{ background: "var(--info-bg)", border: "1px solid var(--info-border)", borderRadius: 12, padding: "12px 16px", marginBottom: 16 }}>
        <div style={{ fontSize: 12.5, color: "var(--text)", lineHeight: 1.55 }}>
          La <strong>date limite de dépôt</strong> est celle qui compte pour le client : c’est le dernier
          jour où il peut vous remettre son colis. Un départ dont la limite est passée disparaît
          automatiquement de l’Espace Client — inutile d’annoncer une échéance intenable.
        </div>
      </div>

      {passes > 0 && (
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>
          {passes} départ{passes > 1 ? "s" : ""} dont la limite est dépassée — plus visible{passes > 1 ? "s" : ""} par les clients, à retirer quand vous voulez.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
        {departs.length === 0 && (
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 26, textAlign: "center", color: "var(--muted)", fontSize: 13.5 }}>
            Aucun départ programmé. Ajoutez-en un : vos clients le verront aussitôt.
          </div>
        )}
        {departs.map((d, i) => {
          const depasse = d.dateLimite && new Date(d.dateLimite).getTime() < Date.now();
          return (
            <div key={d.id || i} style={{ background: "var(--surface)", border: "1px solid " + (depasse ? "var(--border)" : "var(--ok-border)"),
                                          borderRadius: 12, padding: "14px 16px", opacity: depasse ? 0.6 : 1 }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
                <Field label="Destination">
                  <select value={d.pays} onChange={(e) => majDepart(i, "pays", e.target.value)} style={{ ...inputStyle, width: 150, marginBottom: 0 }}>
                    {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{FLAGS[c.code] || ""} {c.city}</option>)}
                  </select>
                </Field>
                <Field label="Mode">
                  <select value={d.mode} onChange={(e) => majDepart(i, "mode", e.target.value)} style={{ ...inputStyle, width: 110, marginBottom: 0 }}>
                    <option value="air">Aérien</option>
                    <option value="mer">Maritime</option>
                  </select>
                </Field>
                <Field label="Date limite de dépôt">
                  <input type="date" value={d.dateLimite || ""} onChange={(e) => majDepart(i, "dateLimite", e.target.value)} style={{ ...inputStyle, width: 160, marginBottom: 0 }} />
                </Field>
                <Field label="Départ prévu">
                  <input type="date" value={d.dateDepart || ""} onChange={(e) => majDepart(i, "dateDepart", e.target.value)} style={{ ...inputStyle, width: 160, marginBottom: 0 }} />
                </Field>
                <button onClick={() => setDeparts((x) => x.filter((_, k) => k !== i))}
                  style={{ background: "none", border: "none", color: "var(--danger-fg)", cursor: "pointer", padding: "9px 4px" }}>
                  <Trash2 size={15} />
                </button>
              </div>
              <Field label="Précision pour le client (facultatif)">
                <input value={d.note || ""} onChange={(e) => majDepart(i, "note", e.target.value)}
                  placeholder="Arrivée estimée à Conakry vers le 20, dépôt jusqu’à 17h…"
                  style={{ ...inputStyle, marginBottom: 0 }} />
              </Field>
              {depasse && <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 8 }}>Date limite dépassée — n’apparaît plus côté client.</div>}
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 10, justifyContent: "space-between", flexWrap: "wrap" }}>
        <button onClick={ajouter} style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: 8, padding: "10px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          + Programmer un départ
        </button>
        <button onClick={() => { persist({ ...data, departs }); notify?.("Calendrier enregistré"); }} disabled={!modifie}
          style={{ background: modifie ? "var(--brand-solid)" : "var(--surface2)", color: modifie ? "#fff" : "var(--muted)",
                   border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 13.5, fontWeight: 700, cursor: modifie ? "pointer" : "not-allowed" }}>
          Enregistrer
        </button>
      </div>
    </div>
  );
}

function NotificationsWhatsAppPage({ data, persist, notify, onBack }) {
  const prefs = data.notifWhatsApp || {};
  const [brouillon, setBrouillon] = useState(prefs);
  const modifie = JSON.stringify(brouillon) !== JSON.stringify(prefs);

  function basculer(cle, qui) {
    setBrouillon((p) => ({ ...p, [cle]: { ...(p[cle] || {}), [qui]: !(p[cle] || {})[qui] } }));
  }

  const Interrupteur = ({ actif, onClick }) => (
    <button onClick={onClick} aria-pressed={actif}
      style={{ width: 44, height: 24, borderRadius: 20, border: "none", padding: 2, cursor: "pointer",
               background: actif ? "var(--ok-fg)" : "var(--surface2)", display: "flex",
               justifyContent: actif ? "flex-end" : "flex-start", transition: "background .15s" }}>
      <span style={{ width: 20, height: 20, borderRadius: 20, background: "#fff", display: "block" }} />
    </button>
  );

  return (
    <div>
      <ConfigPageHeader title="Notifications clients" desc="Choisissez qui est prévenu automatiquement, et pour quel événement. Les messages partent par WhatsApp et par e-mail." onBack={onBack} />

      <div style={{ background: "var(--info-bg)", border: "1px solid var(--info-border)", borderRadius: 12, padding: "12px 16px", marginBottom: 16 }}>
        <div style={{ fontSize: 12.5, color: "var(--text)" }}>
          Les messages partent automatiquement dès qu’un agent effectue l’action correspondante :
          par <strong>WhatsApp</strong> sur le numéro du client, et par <strong>e-mail</strong> si une
          adresse est renseignée. Un client qui a donné son adresse suit ainsi son colis de
          l’enregistrement à la livraison, même sans WhatsApp.
          Si l’envoi automatique n’est pas disponible, l’action se déroule normalement et le message
          peut être envoyé à la main depuis la fiche du colis.
        </div>
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--surface2)", textAlign: "left" }}>
              <th style={{ padding: "12px 16px", fontSize: 11, color: "var(--muted)", fontWeight: 700, letterSpacing: 0.5 }}>ÉVÉNEMENT</th>
              <th style={{ padding: "12px 16px", fontSize: 11, color: "var(--muted)", fontWeight: 700, letterSpacing: 0.5, textAlign: "center", width: 120 }}>EXPÉDITEUR</th>
              <th style={{ padding: "12px 16px", fontSize: 11, color: "var(--muted)", fontWeight: 700, letterSpacing: 0.5, textAlign: "center", width: 120 }}>DESTINATAIRE</th>
            </tr>
          </thead>
          <tbody>
            {EVENEMENTS_WHATSAPP.map((e) => (
              <tr key={e.cle} style={{ borderTop: "1px solid var(--surface2)" }}>
                <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--text)" }}>{e.label}</td>
                <td style={{ padding: "12px 16px", textAlign: "center" }}>
                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <Interrupteur actif={!!(brouillon[e.cle] || {}).expediteur} onClick={() => basculer(e.cle, "expediteur")} />
                  </div>
                </td>
                <td style={{ padding: "12px 16px", textAlign: "center" }}>
                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <Interrupteur actif={!!(brouillon[e.cle] || {}).destinataire} onClick={() => basculer(e.cle, "destinataire")} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/*
        Repris de l'ancienne page « Notifications », supprimée car elle faisait double emploi.
        Utile quand l'envoi automatique n'est pas disponible : l'application ouvre alors un
        brouillon WhatsApp que l'agent n'a plus qu'à envoyer.
      */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "16px 18px", marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>Ouvrir un brouillon si l’envoi automatique échoue</div>
            <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 3, lineHeight: 1.5 }}>
              À chaque changement de statut fait à la main, WhatsApp s’ouvre avec le message pré-rempli.
              L’agent n’a plus qu’à appuyer sur Envoyer.
            </div>
          </div>
          <Interrupteur
            actif={!!data.notificationSettings?.ouvertureAutoWhatsApp}
            onClick={() => {
              const s = data.notificationSettings || {};
              persist({ ...data, notificationSettings: { ...s, ouvertureAutoWhatsApp: !s.ouvertureAutoWhatsApp } });
              notify?.("Préférence enregistrée");
            }}
          />
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
        <button onClick={() => { persist({ ...data, notifWhatsApp: brouillon }); notify?.("Préférences enregistrées"); }}
          disabled={!modifie}
          style={{ background: modifie ? "var(--brand-solid)" : "var(--surface2)", color: modifie ? "#fff" : "var(--muted)",
                   border: "none", borderRadius: 8, padding: "11px 24px", fontSize: 13.5, fontWeight: 700,
                   cursor: modifie ? "pointer" : "not-allowed" }}>
          Enregistrer les préférences
        </button>
      </div>
    </div>
  );
}

/**
 * Sauvegarde et restauration complètes.
 *
 * Aucun moyen n'existait pour sortir l'ensemble des données de la plateforme. Les exports Excel
 * et CSV ne couvrent que des vues partielles — de quoi analyser, pas de quoi reconstruire.
 *
 * Si la base devient inaccessible, si une manipulation efface des données, ou simplement pour
 * changer d'hébergeur, ce fichier est le seul filet. Il contient tout : colis, clients,
 * paiements, catégories, tarifs, comptes, journal.
 */
function SauvegardePage({ data, persist, notify, session, onBack }) {
  const [restauration, setRestauration] = useState(null);
  const [erreur, setErreur] = useState("");

  /** Récapitulatif de ce que contient la base, affiché avant de proposer la sauvegarde. */
  const compte = {
    colis: (data.colis || []).length,
    clients: (data.clientAccounts || []).length,
    categories: (data.categories || []).length,
    utilisateurs: (data.users || []).length,
    depenses: (data.depenses || []).length,
    journal: (data.activityLog || []).length,
  };

  /*
   * Téléchargement de la sauvegarde.
   *
   * Les empreintes de mots de passe sont retirées : elles ne permettent pas de retrouver un mot
   * de passe, mais une sauvegarde circule par e-mail ou clé USB — autant ne rien exposer.
   */
  function telecharger() {
    const sansSecrets = {
      ...data,
      users: (data.users || []).map(({ motdepasse, motdepasseSecure, motdepasseSalt, ...reste }) => reste),
      clientAccounts: (data.clientAccounts || []).map(({ motdepasse, motdepasseSecure, motdepasseSalt, ...reste }) => reste),
    };
    const contenu = {
      format: "ba-diaby-express-sauvegarde",
      version: 1,
      genereLe: new Date().toISOString(),
      generePar: `${session?.prenom || ""} ${session?.nom || ""}`.trim(),
      motsDePasseExclus: true,
      donnees: sansSecrets,
    };
    const blob = new Blob([JSON.stringify(contenu, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `sauvegarde-ba-diaby-express-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    notify?.("Sauvegarde téléchargée");
  }

  const [chargementRef, setChargementRef] = useState(null);

  /*
   * Chargement des données de référence dans une base existante.
   *
   * Les catégories, le répertoire clients et le compte administrateur sont livrés comme valeurs
   * par défaut : ils ne s'appliquent qu'à une base vide. Une plateforme déjà en service les
   * ignore donc — c'est voulu, sinon chaque déploiement écraserait le travail en cours.
   *
   * Ce bouton comble ce manque : il AJOUTE ce qui est absent, sans jamais remplacer l'existant.
   * Les colis, paiements et écritures comptables ne sont pas touchés.
   */
  function preparerChargementRef() {
    const catsExistantes = new Set((data.categories || []).map((c) => (c.nom || "").toLowerCase()));
    const catsAAjouter = DONNEES_REFERENCE.categories.filter((c) => !catsExistantes.has(c.nom.toLowerCase()));

    const telsExistants = new Set(
      [...(data.colis || []).map((c) => normaliserTelephone(c.telephone)),
       ...(data.repertoire || []).map((c) => normaliserTelephone(c.telephone))].filter(Boolean)
    );
    const clientsAAjouter = REPERTOIRE_IMPORTE.filter((c) => !telsExistants.has(normaliserTelephone(c.telephone)));

    const identifiants = new Set((data.users || []).map((u) => (u.identifiant || "").toLowerCase()));
    const compteAAjouter = identifiants.has("iboush") ? null : DONNEES_REFERENCE.admin;

    setChargementRef({ catsAAjouter, clientsAAjouter, compteAAjouter });
  }

  function chargerReference() {
    const { catsAAjouter, clientsAAjouter, compteAAjouter } = chargementRef;
    const depart = (data.categories || []).length;
    persist({
      ...data,
      categories: [
        ...(data.categories || []),
        ...catsAAjouter.map((c, i) => ({ ...c, id: `cat-ref-${depart + i}`, ordre: depart + i })),
      ],
      repertoire: [...(data.repertoire || []), ...clientsAAjouter],
      users: compteAAjouter ? [...(data.users || []), compteAAjouter] : data.users,
      activityLog: pushActivity(data, session, "Données de référence chargées",
        `${catsAAjouter.length} catégorie(s), ${clientsAAjouter.length} client(s)${compteAAjouter ? ", compte Iboush" : ""}`),
    });
    setChargementRef(null);
    notify?.("Données de référence ajoutées");
  }

  function lireFichier(e) {
    setErreur("");
    const fichier = e.target.files?.[0];
    if (!fichier) return;
    const lecteur = new FileReader();
    lecteur.onload = () => {
      try {
        const contenu = JSON.parse(lecteur.result);
        if (contenu.format !== "ba-diaby-express-sauvegarde" || !contenu.donnees) {
          setErreur("Ce fichier n’est pas une sauvegarde Ba-Diaby Express.");
          return;
        }
        setRestauration(contenu);
      } catch (err) {
        setErreur("Fichier illisible. Vérifiez qu’il n’a pas été modifié.");
      }
    };
    lecteur.readAsText(fichier);
    e.target.value = "";
  }

  function restaurer() {
    /*
     * Les comptes actuels sont conservés : sans eux, plus personne ne pourrait se connecter
     * après une restauration — y compris l'administrateur en train de la faire.
     */
    const d = restauration.donnees;
    persist({
      ...d,
      users: data.users,
      activityLog: pushActivity(data, session, "Données restaurées",
        `Sauvegarde du ${new Date(restauration.genereLe).toLocaleDateString("fr-FR")}`),
    });
    setRestauration(null);
    notify?.("Données restaurées");
  }

  const ligne = (label, valeur) => (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "5px 0" }}>
      <span style={{ color: "var(--muted)" }}>{label}</span>
      <span style={{ color: "var(--text)", fontWeight: 600 }}>{valeur}</span>
    </div>
  );

  return (
    <div>
      <ConfigPageHeader title="Sauvegarde des données" desc="Téléchargez une copie complète de votre plateforme, ou restaurez-la depuis un fichier." onBack={onBack} />

      {/*
        Poids des données.

        L'application réécrit l'intégralité des données à chaque modification. Les photos, gardées
        en base64, en représentent l'essentiel : au-delà de quelques dizaines de méga-octets, la
        moindre opération devient lente sur une connexion mobile. Mieux vaut le voir venir que le
        découvrir un jour où le comptoir est plein.
      */}
      {(() => {
        const octets = new Blob([JSON.stringify(data)]).size;
        const mo = octets / (1024 * 1024);
        const photos = (data.colis || []).reduce((n, c) => n + (c.photos || []).length, 0);
        const alerte = mo >= 40 ? "danger" : mo >= 15 ? "warn" : "ok";
        if (alerte === "ok") return null;
        return (
          <div style={{ background: alerte === "danger" ? "var(--danger-bg)" : "var(--warn-bg)",
                        border: "1px solid " + (alerte === "danger" ? "var(--danger-border)" : "var(--warn-border)"),
                        borderRadius: 12, padding: "13px 16px", maxWidth: 560, marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: alerte === "danger" ? "var(--danger-fg)" : "var(--warn-fg)" }}>
              Vos données pèsent {mo.toFixed(1)} Mo
            </div>
            <div style={{ fontSize: 12, color: "var(--text)", marginTop: 4, lineHeight: 1.55 }}>
              {photos} photo{photos > 1 ? "s" : ""} enregistrée{photos > 1 ? "s" : ""}. L’application transmet
              l’ensemble des données à chaque modification : au-delà de 40 Mo, les agents constateront
              des lenteurs sur connexion mobile.
              {alerte === "danger"
                ? " Envisagez de supprimer les photos des colis livrés depuis longtemps."
                : " Surveillez cette valeur."}
            </div>
          </div>
        );
      })()}

      {/*
        Chargement des données de référence.

        Les catégories, le répertoire et le compte administrateur livrés avec l'application ne
        s'appliquent qu'à une base vide. Ce bouton permet de les ajouter à une base déjà en
        service, sans rien remplacer.
      */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--info-border)", borderRadius: 14, padding: 22, maxWidth: 560, marginBottom: 20 }}>
        <div style={{ fontWeight: 700, color: "var(--text)", fontSize: 14, marginBottom: 4 }}>Données de référence</div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 14, lineHeight: 1.55 }}>
          Catégories tarifaires, répertoire clients et compte administrateur livrés avec l’application.
          Ils ne s’appliquent qu’à une base vide : utilisez ce bouton pour les ajouter à votre base
          existante. Rien n’est remplacé, et vos colis, paiements et écritures ne sont pas touchés.
        </div>
        <button onClick={preparerChargementRef}
          style={{ display: "flex", alignItems: "center", gap: 7, background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: 8, padding: "11px 20px", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>
          <Upload size={15} /> Vérifier ce qui manque
        </button>
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 22, maxWidth: 560, marginBottom: 20 }}>
        <div style={{ fontWeight: 700, color: "var(--text)", fontSize: 14, marginBottom: 4 }}>Télécharger une sauvegarde</div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 14, lineHeight: 1.55 }}>
          Un seul fichier contenant l’intégralité de vos données. Conservez-le hors de la plateforme —
          sur votre ordinateur ou un espace de stockage en ligne.
        </div>
        <div style={{ background: "var(--surface2)", borderRadius: 8, padding: "12px 14px", marginBottom: 16 }}>
          {ligne("Colis", compte.colis)}
          {ligne("Comptes clients", compte.clients)}
          {ligne("Catégories", compte.categories)}
          {ligne("Utilisateurs", compte.utilisateurs)}
          {ligne("Dépenses", compte.depenses)}
          {ligne("Entrées du journal", compte.journal)}
          {ligne("Photos", (data.colis || []).reduce((n, c) => n + (c.photos || []).length, 0))}
          {ligne("Poids total", `${(new Blob([JSON.stringify(data)]).size / (1024 * 1024)).toFixed(1)} Mo`)}
        </div>
        <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 14 }}>
          Les mots de passe ne sont pas inclus : le fichier peut circuler sans exposer les accès.
        </div>
        <button onClick={telecharger}
          style={{ display: "flex", alignItems: "center", gap: 7, background: "var(--brand-solid)", color: "#fff", border: "none", borderRadius: 8, padding: "11px 20px", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>
          <Download size={15} /> Télécharger la sauvegarde
        </button>
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--danger-border)", borderRadius: 14, padding: 22, maxWidth: 560 }}>
        <div style={{ fontWeight: 700, color: "var(--danger-fg)", fontSize: 14, marginBottom: 4 }}>Restaurer depuis un fichier</div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 14, lineHeight: 1.55 }}>
          Remplace les données actuelles par celles du fichier. À n’utiliser qu’en cas de perte
          ou pour transférer la plateforme.
        </div>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: 8, padding: "10px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          <Upload size={14} /> Choisir un fichier
          <input type="file" accept="application/json,.json" onChange={lireFichier} style={{ display: "none" }} />
        </label>
        {erreur && <div style={{ fontSize: 12.5, color: "var(--danger-fg)", marginTop: 10 }}>{erreur}</div>}
      </div>

      {chargementRef && (
        <ConfirmerAction
          titre="Ajouter les données de référence ?"
          message={
            chargementRef.catsAAjouter.length === 0 && chargementRef.clientsAAjouter.length === 0 && !chargementRef.compteAAjouter
              ? "Tout est déjà présent : aucune donnée à ajouter."
              : `${chargementRef.catsAAjouter.length} catégorie(s), ${chargementRef.clientsAAjouter.length} client(s)${chargementRef.compteAAjouter ? ", et le compte Iboush" : ""} seront ajoutés.`
          }
          consequence="Aucun élément existant n’est modifié ni supprimé. Les catégories déjà présentes sous le même nom sont ignorées, de même que les clients ayant le même numéro."
          libelleAction="Ajouter"
          onConfirmer={chargerReference}
          onAnnuler={() => setChargementRef(null)}
        />
      )}

      {restauration && (
        <ConfirmerAction
          titre="Restaurer ces données ?"
          message={`Sauvegarde du ${new Date(restauration.genereLe).toLocaleString("fr-FR")}${restauration.generePar ? `, créée par ${restauration.generePar}` : ""} — ${(restauration.donnees.colis || []).length} colis, ${(restauration.donnees.clientAccounts || []).length} comptes clients.`}
          consequence="Toutes les données actuelles seront remplacées. Les comptes utilisateurs et leurs mots de passe sont conservés pour que vous puissiez rester connecté. Téléchargez d’abord une sauvegarde de l’état présent si vous avez le moindre doute."
          libelleAction="Restaurer"
          onConfirmer={restaurer}
          onAnnuler={() => setRestauration(null)}
        />
      )}
    </div>
  );
}

function SitesOperationPage({ data, persist, notify, onBack }) {
  const [siteASupprimer, setSiteASupprimer] = useState(null);
  const sites = data.sites || [];
  /*
   * Seuls les sites en Guinée servent à l'enregistrement d'un colis et à l'agence de retrait de
   * l'Espace Client : ce sont des points physiques tenus par nos agents. Un site à l'étranger
   * (ajouté ici pour qu'un pays de destination ait un point de retrait sur le ticket, ex. Maroc)
   * n'a pas sa place dans ces deux listes, sous peine de proposer aux agents un site où ils ne
   * peuvent pas enregistrer de colis.
   */
  const sitesGN = sitesLocaux(sites);
  const [form, setForm] = useState(null);

  function saveSite() {
    if (!form.nom) return;
    const exists = sites.some((s) => s.id === form.id);
    const next = exists ? sites.map((s) => (s.id === form.id ? form : s)) : [...sites, { ...form, id: form.id || `s${Date.now()}` }];
    /*
     * Si le site édité est l'agence de retrait de l'Espace Client et qu'on lui retire son
     * rattachement Guinée, cette référence deviendrait obsolète (un site étranger ne sert que de
     * point de retrait sur le ticket, jamais d'agence Espace Client). On la fait suivre vers un
     * autre site local plutôt que de laisser une agence de retrait qui n'existe plus vraiment.
     */
    let agenceRetraitClient = data.agenceRetraitClient;
    if (exists && form.id === agenceRetraitClient && form.pays && form.pays !== "GN") {
      agenceRetraitClient = sitesLocaux(next.filter((s) => s.id !== form.id))[0]?.id || "";
    }
    persist({ ...data, sites: next, agenceRetraitClient });
    notify?.(exists ? "Site mis à jour" : "Site ajouté");
    setForm(null);
  }
  function removeSite(id) { persist({ ...data, sites: sites.filter((s) => s.id !== id) }); }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
      {siteASupprimer && (
        <ConfirmerAction
          titre="Supprimer ce site ?"
          message={`Le site « ${siteASupprimer.nom} » ne sera plus proposé aux agents.`}
          consequence="Les colis déjà enregistrés sur ce site conservent leur historique. Vérifiez qu’aucun agent n’y est affecté, sinon il ne pourra plus enregistrer de colis."
          onConfirmer={() => { removeSite(siteASupprimer.id); setSiteASupprimer(null); }}
          onAnnuler={() => setSiteASupprimer(null)}
        />
      )}
        <ConfigPageHeader title="Sites d’opération" desc="Gérez vos points d’enregistrement et de retrait, et les informations affichées sur le ticket d’envoi." onBack={onBack} />
        <button onClick={() => setForm({ nom: "", pays: "GN", adresse: "", telephone: "", horaires: "", paiements: "", stockage: "" })} style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--brand-solid)", color: "#fff", border: "none", borderRadius: 8, padding: "10px 16px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}><Plus size={16} /> Ajouter un site</button>
      </div>
      <div style={{ background: "var(--info-bg)", border: "1px solid var(--info-border)", borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>Agence de retrait de l’Espace Client</div>
        <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 10 }}>
          Adresse communiquée aux clients de l’Espace Client dès que leur colis est disponible. Une seule agence, pour éviter toute confusion.
        </div>
        <select value={data.agenceRetraitClient || "site-bambeto"}
          onChange={(e) => { persist({ ...data, agenceRetraitClient: e.target.value }); notify?.("Agence de retrait mise à jour"); }}
          style={{ ...inputStyle, maxWidth: 320, marginBottom: 0 }}>
          {sitesGN.map((s) => <option key={s.id} value={s.id}>{s.nom} — {s.adresse}</option>)}
        </select>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 14 }}>
        {sites.map((s) => (
          <div key={s.id} style={{ background: "var(--surface)", borderRadius: 14, padding: 18, border: "1px solid var(--border)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{s.nom}</div>
                {s.pays && s.pays !== "GN" && (
                  <div style={{ fontSize: 11, color: "var(--info-fg)", marginTop: 2 }}>
                    {FLAGS[s.pays] || ""} {COUNTRIES.find((c) => c.code === s.pays)?.name || s.pays} · retrait uniquement
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setForm({ pays: "GN", ...s })} style={{ background: "none", border: "none", color: "var(--info-fg)", cursor: "pointer" }}><Settings size={14} /></button>
                <button onClick={() => setSiteASupprimer(s)} style={{ background: "none", border: "none", color: "var(--danger-fg)", cursor: "pointer" }}><Trash2 size={14} /></button>
              </div>
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>{s.adresse}</div>
            {s.telephone && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>📞 {s.telephone}</div>}
            {s.horaires && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>🕒 {s.horaires}</div>}
            {s.paiements && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>💳 {s.paiements}</div>}
            {s.stockage && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>📦 {s.stockage}</div>}
          </div>
        ))}
        {sites.length === 0 && <div style={{ color: "var(--muted)", fontSize: 13 }}>Aucun site enregistré — ajoutez Bambeto, Madina, etc.</div>}
      </div>
      {form && (
        <Modal onClose={() => setForm(null)} title={form.id ? "Modifier le site" : "Nouveau site"}>
          <Field label="Nom"><input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} style={inputStyle} placeholder="ex: Bambeto" /></Field>
          <Field label="Pays">
            <select value={form.pays || "GN"} onChange={(e) => setForm({ ...form, pays: e.target.value })} style={inputStyle}>
              {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{FLAGS[c.code] || ""} {c.name}</option>)}
            </select>
          </Field>
          {form.pays && form.pays !== "GN" && (
            <div style={{ background: "var(--info-bg)", border: "1px solid var(--info-border)", borderRadius: 8, padding: "8px 12px", fontSize: 11.5, color: "var(--muted)", marginBottom: 14 }}>
              Ce site n’apparaîtra pas dans les agences d’enregistrement ni comme agence de retrait de l’Espace Client — il servira uniquement de point de retrait sur le ticket des colis envoyés vers ce pays.
            </div>
          )}
          <Field label="Adresse"><input value={form.adresse} onChange={(e) => setForm({ ...form, adresse: e.target.value })} style={inputStyle} /></Field>
          <Field label="Téléphone"><input value={form.telephone || ""} onChange={(e) => setForm({ ...form, telephone: e.target.value })} style={inputStyle} placeholder="+224..." /></Field>
          <Field label="Horaires"><input value={form.horaires} onChange={(e) => setForm({ ...form, horaires: e.target.value })} style={inputStyle} placeholder="Lun-Sam 8h-18h" /></Field>
          <Field label="Moyens de paiement acceptés"><input value={form.paiements} onChange={(e) => setForm({ ...form, paiements: e.target.value })} style={inputStyle} placeholder="Espèces, Orange Money" /></Field>
          <Field label="Infos stockage"><input value={form.stockage} onChange={(e) => setForm({ ...form, stockage: e.target.value })} style={inputStyle} placeholder="Retrait sous 7 jours" /></Field>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
            <button onClick={() => setForm(null)} style={{ padding: "9px 16px", borderRadius: 8, border: "1.5px solid var(--border)", background: "var(--surface2)", color: "var(--muted)", fontSize: 13, cursor: "pointer" }}>Annuler</button>
            <button onClick={saveSite} style={{ padding: "9px 16px", borderRadius: 8, border: "none", background: "var(--brand-solid)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Enregistrer</button>
          </div>
        </Modal>
      )}
    </div>
  );
}



function PaiementConfigPage({ data, persist, notify, onBack }) {
  const cfg = data.paymentConfig || {};
  const [orangeMoney, setOrangeMoney] = useState(cfg.orangeMoney || "");
  const [mtnMoney, setMtnMoney] = useState(cfg.mtnMoney || "");
  const [titulaire, setTitulaire] = useState(cfg.titulaire || "");
  function save() {
    persist({ ...data, paymentConfig: { orangeMoney, mtnMoney, titulaire } });
    notify?.("Configuration de paiement enregistrée");
  }
  return (
    <div>
      <ConfigPageHeader title="Paiement" desc="Configurez vos numéros Mobile Money pour recevoir les paiements de vos clients." onBack={onBack} />
      <div style={{ background: "var(--surface)", borderRadius: 14, padding: 22, maxWidth: 460, border: "1px solid var(--border)" }}>
        <Field label="Numéro Orange Money"><input value={orangeMoney} onChange={(e) => setOrangeMoney(e.target.value)} style={inputStyle} placeholder="+224 6XX XXX XXX" /></Field>
        <Field label="Numéro MTN Mobile Money"><input value={mtnMoney} onChange={(e) => setMtnMoney(e.target.value)} style={inputStyle} placeholder="+224 6XX XXX XXX" /></Field>
        <Field label="Titulaire du compte"><input value={titulaire} onChange={(e) => setTitulaire(e.target.value)} style={inputStyle} /></Field>
        <div style={{ background: "var(--surface2)", borderRadius: 8, padding: "10px 12px", fontSize: 11.5, color: "var(--muted)", marginBottom: 16 }}>
          Le paiement en ligne par carte nécessite un compte Stripe ou une passerelle Mobile Money connectée côté serveur — voir le cahier des charges technique. Ces numéros sont pour l’instant affichés à titre informatif à vos agents.
        </div>
        <button onClick={save} style={{ background: "#3D63FF", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Enregistrer</button>
      </div>
    </div>
  );
}

function BrandingPage({ data, persist, notify, onBack }) {
  const b = data.branding || {};
  const [nom, setNom] = useState(b.nom || "Ba-Diaby Express");
  const [tagline, setTagline] = useState(b.tagline || "La Ponte entre la France et la Guinée");
  const [logo, setLogo] = useState(b.logo || null);

  function onLogoChange(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setLogo(reader.result);
    reader.readAsDataURL(file);
  }
  function save() {
    persist({ ...data, branding: { nom, tagline, logo } });
    notify?.("Identité mise à jour");
  }
  return (
    <div>
      <ConfigPageHeader title="Branding & Identité" desc="Logo, textes légaux et personnalisation de l’identité." onBack={onBack} />
      <div style={{ background: "var(--surface)", borderRadius: 14, padding: 22, maxWidth: 460, border: "1px solid var(--border)" }}>
        <Field label="Nom de l’entreprise"><input value={nom} onChange={(e) => setNom(e.target.value)} style={inputStyle} /></Field>
        <Field label="Slogan"><input value={tagline} onChange={(e) => setTagline(e.target.value)} style={inputStyle} /></Field>
        <Field label="Logo">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {logo ? <img src={logo} alt="logo" style={{ width: 48, height: 48, borderRadius: 8, objectFit: "cover", border: "1px solid var(--border)" }} /> : <div style={{ width: 48, height: 48, borderRadius: 8, background: "var(--surface2)" }} />}
            <label style={{ ...smallBtn, cursor: "pointer" }}>Choisir un fichier<input type="file" accept="image/*" onChange={onLogoChange} style={{ display: "none" }} /></label>
          </div>
        </Field>
        <button onClick={save} style={{ marginTop: 8, background: "#3D63FF", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Enregistrer</button>
      </div>
    </div>
  );
}

function JournalActivitePage({ data, onBack }) {
  /*
   * La recherche libre existait déjà. S'y ajoutent trois choses qui manquaient pour que le
   * journal serve vraiment : filtrer par période et par utilisateur (chercher « qui a encaissé
   * hier » demandait de faire défiler 500 lignes), un repère de couleur par nature d'opération,
   * et un export CSV pour conserver une trace hors de l'application.
   */
  const [query, setQuery] = useState("");
  const [periode, setPeriode] = useState("7j");
  const [auteur, setAuteur] = useState("tous");
  const [nbAffiches, setNbAffiches] = useState(100);
  const log = data.activityLog || [];

  const auteurs = useMemo(() => [...new Set(log.map((e) => e.utilisateur).filter(Boolean))].sort(), [log]);

  const filtered = useMemo(() => {
    const maintenant = Date.now();
    const jours = { "1j": 1, "7j": 7, "30j": 30, tout: null }[periode];
    const q = pourRecherche(query.trim());
    return log.filter((e) => {
      if (jours && (maintenant - new Date(e.date).getTime()) / 86400000 > jours) return false;
      if (auteur !== "tous" && e.utilisateur !== auteur) return false;
      if (!q) return true;
      return pourRecherche(e.action).includes(q) || pourRecherche(e.detail).includes(q) || pourRecherche(e.utilisateur).includes(q);
    });
  }, [log, periode, auteur, query]);

  useEffect(() => { setNbAffiches(100); }, [periode, auteur, query]);
  const visibles = filtered.slice(0, nbAffiches);

  /** Repère de couleur : rouge pour ce qui retire ou annule, vert pour l'argent encaissé. */
  function teinte(action) {
    const a = String(action || "").toLowerCase();
    if (/supprim|annul|refus|perdu|réinitialis/.test(a)) return "var(--danger-fg)";
    if (/encaiss|paiement|remise|indemnit/.test(a)) return "var(--ok-fg)";
    if (/modifi|statut|express/.test(a)) return "var(--warn-fg)";
    return "var(--info-fg)";
  }

  function exporterJournal() {
    const lignes = [["Date", "Heure", "Utilisateur", "Rôle", "Action", "Détail"]];
    filtered.forEach((e) => {
      const d = new Date(e.date);
      lignes.push([d.toLocaleDateString("fr-FR"), d.toLocaleTimeString("fr-FR"), e.utilisateur || "", e.role || "", e.action || "", e.detail || ""]);
    });
    const csv = lignes.map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `journal-activite-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div>
      <ConfigPageHeader title="Journal d’activité" desc="Historique complet des actions effectuées par les utilisateurs (les 500 dernières)." onBack={onBack} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12, alignItems: "center" }}>
        {[["1j", "Aujourd’hui"], ["7j", "7 jours"], ["30j", "30 jours"], ["tout", "Tout"]].map(([k, label]) => (
          <button key={k} onClick={() => setPeriode(k)}
            style={{ padding: "7px 14px", borderRadius: 20, cursor: "pointer", fontSize: 12.5, fontWeight: 600,
                     border: "1.5px solid " + (periode === k ? "var(--brand-solid)" : "var(--border)"),
                     background: periode === k ? "var(--brand-solid)" : "var(--surface)",
                     color: periode === k ? "#fff" : "var(--muted)" }}>{label}</button>
        ))}
        <select value={auteur} onChange={(e) => setAuteur(e.target.value)} style={{ ...inputStyle, width: "auto", marginBottom: 0, padding: "7px 12px" }}>
          <option value="tous">Tous les utilisateurs</option>
          {auteurs.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        {filtered.length > 0 && (
          <button onClick={exporterJournal} style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--surface)", border: "1.5px solid var(--border)", color: "var(--text)", borderRadius: 8, padding: "7px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
            <Download size={13} /> Exporter (CSV)
          </button>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", marginBottom: 18, maxWidth: 420 }}>
        <Search size={15} color="var(--muted)" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher une action, un utilisateur..." style={{ border: "none", outline: "none", background: "none", flex: 1, fontSize: 13.5, color: "var(--text)" }} />
      </div>
      <div style={{ background: "var(--surface)", borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden" }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 20, color: "var(--muted)", fontSize: 13 }}>Aucune activité enregistrée pour le moment.</div>
        ) : visibles.map((e) => (
          <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, padding: "12px 16px", borderTop: "1px solid var(--border)" }}>
            <div style={{ width: 4, alignSelf: "stretch", borderRadius: 4, background: teinte(e.action), flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: "var(--text)", fontWeight: 600 }}>{e.action}</div>
              {e.detail && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{e.detail}</div>}
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>{e.utilisateur} · {e.role}</div>
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap" }}>{new Date(e.date).toLocaleString("fr-FR")}</div>
          </div>
        ))}
        {filtered.length > visibles.length && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, padding: "12px 16px", borderTop: "1px solid var(--border)" }}>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>{visibles.length} sur {filtered.length}</span>
            <button onClick={() => setNbAffiches((n) => n + 100)} style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: 8, padding: "7px 16px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
              Afficher 100 de plus
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ParametresSystemePage({ data, persist, notify, onBack, offline }) {
  const [confirmReset, setConfirmReset] = useState(false);
  const fileRef = useRef(null);
  const [backups, setBackups] = useState(null);
  const [restoring, setRestoring] = useState(null);
  const [confirmRestore, setConfirmRestore] = useState(null);

  useEffect(() => {
    listBackups().then(setBackups);
  }, []);

  async function restaurerBackup(key) {
    setRestoring(key);
    try {
      const snapshot = await loadBackup(key);
      persist(snapshot);
      notify?.(`Données restaurées depuis la sauvegarde du ${key.replace(BACKUP_PREFIX, "")}`);
    } catch (e) {
      notify?.("Échec de la restauration de cette sauvegarde");
    }
    setRestoring(null);
    setConfirmRestore(null);
  }

  function resetColis() {
    persist({ ...data, colis: [] });
    notify?.("Tous les colis ont été supprimés");
    setConfirmReset(false);
  }

  function exportBackup() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `ba-diaby-express-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    notify?.("Sauvegarde téléchargée");
  }
  function importBackup(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed.users || !parsed.colis) throw new Error("format invalide");
        persist(parsed);
        notify?.("Données restaurées depuis la sauvegarde");
      } catch (err) {
        notify?.("Échec de la restauration — fichier invalide");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function exportColisCSV() {
    const headers = ["Tracking", "Statut", "Expediteur", "Destinataire", "Telephone", "Pays", "Mode", "Poids_kg", "Prix_EUR", "Paye_EUR", "Reste_EUR", "Date_creation"];
    const rows = data.colis.map((c) => [c.tracking, c.status, c.expediteur, c.destinataire, c.telephone, c.pays, c.mode, c.poids, c.prix, c.paye, c.reste, new Date(c.createdAt).toLocaleDateString("fr-FR")]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `colis-export-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    notify?.("Export CSV téléchargé");
  }

  async function exportColisExcel() {
    const XLSX = await loadXLSXLib();
    const wb = XLSX.utils.book_new();

    // Feuille 1 — liste complète des colis
    const headers = ["N° de suivi", "Statut", "Expéditeur", "Destinataire", "Téléphone", "Pays", "Mode", "Poids (kg)", "Prix (EUR)", "Payé (EUR)", "Reste (EUR)", "Agence", "Date de création"];
    const rows = data.colis.map((c) => [c.tracking, c.status, c.expediteur, c.destinataire, c.telephone, COUNTRIES.find((x) => x.code === c.pays)?.name || c.pays, c.mode === "air" ? "Aérien" : "Maritime", c.poids, c.prix, c.paye, c.reste, c.site || "—", new Date(c.createdAt).toLocaleDateString("fr-FR")]);
    const ws1 = XLSX.utils.aoa_to_sheet([
      ["BA-DIABY EXPRESS"], [`Export généré le ${new Date().toLocaleDateString("fr-FR")}`], [],
      headers, ...rows,
    ]);
    ws1["!cols"] = headers.map(() => ({ wch: 16 }));
    ws1["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } }];
    XLSX.utils.book_append_sheet(wb, ws1, "Colis");

    // Feuille 2 — statistiques par pays de destination
    const parPays = {};
    data.colis.forEach((c) => {
      const nom = COUNTRIES.find((x) => x.code === c.pays)?.name || c.pays;
      if (!parPays[nom]) parPays[nom] = { count: 0, poids: 0, montant: 0 };
      parPays[nom].count++; parPays[nom].poids += c.poids; parPays[nom].montant += c.prix;
    });
    const statsRows = [["Pays", "Nombre de colis", "Poids total (kg)", "Montant total (EUR)"], ...Object.entries(parPays).map(([nom, s]) => [nom, s.count, +s.poids.toFixed(1), +s.montant.toFixed(2)])];
    const ws2 = XLSX.utils.aoa_to_sheet(statsRows);
    ws2["!cols"] = [{ wch: 20 }, { wch: 16 }, { wch: 16 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, ws2, "Statistiques par pays");

    // Feuille 3 — statistiques par agence
    const parAgence = {};
    data.colis.forEach((c) => {
      const nom = c.site || "Non renseignée";
      if (!parAgence[nom]) parAgence[nom] = { count: 0, poids: 0, montant: 0 };
      parAgence[nom].count++; parAgence[nom].poids += c.poids; parAgence[nom].montant += c.prix;
    });
    const agenceRows = [["Agence", "Nombre de colis", "Poids total (kg)", "Montant total (EUR)"], ...Object.entries(parAgence).map(([nom, s]) => [nom, s.count, +s.poids.toFixed(1), +s.montant.toFixed(2)])];
    const ws3 = XLSX.utils.aoa_to_sheet(agenceRows);
    ws3["!cols"] = [{ wch: 20 }, { wch: 16 }, { wch: 16 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, ws3, "Statistiques par agence");

    XLSX.writeFile(wb, `ba-diaby-express-colis-${new Date().toISOString().slice(0, 10)}.xlsx`);
    notify?.("Export Excel téléchargé");
  }

  return (
    <div>
      <ConfigPageHeader title="Paramètres Système" desc="Options avancées de la plateforme." onBack={onBack} />
      <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 460 }}>
        <div style={{ background: "var(--surface)", borderRadius: 14, padding: 20, border: "1px solid var(--border)" }}>
          <div style={{ fontWeight: 700, color: "var(--text)", fontSize: 14, marginBottom: 10 }}>État du système</div>
          <div style={{ fontSize: 13, color: "var(--muted)" }}>Stockage : {offline ? <span style={{ color: "var(--danger-fg)" }}>hors ligne (non sauvegardé)</span> : <span style={{ color: "var(--ok-fg)" }}>connecté</span>}</div>
          <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>Colis enregistrés : {data.colis.length}</div>
          <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>Comptes utilisateurs : {data.users.length}</div>
        </div>

        <div style={{ background: "var(--surface)", borderRadius: 14, padding: 20, border: "1px solid var(--border)" }}>
          <div style={{ fontWeight: 700, color: "var(--text)", fontSize: 14, marginBottom: 10 }}>Sauvegarde &amp; export</div>
          <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 14 }}>Téléchargez une copie complète de vos données, ou restaurez-en une précédemment enregistrée.</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <button onClick={exportBackup} style={{ display: "flex", alignItems: "center", gap: 6, background: "#3D63FF", color: "#fff", border: "none", borderRadius: 8, padding: "9px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}><Download size={13} /> Sauvegarder (JSON)</button>
            <button onClick={() => fileRef.current?.click()} style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--surface2)", color: "var(--text)", border: "1.5px solid var(--border)", borderRadius: 8, padding: "9px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}><RefreshCw size={13} /> Restaurer une sauvegarde</button>
            <input ref={fileRef} type="file" accept=".json" onChange={importBackup} style={{ display: "none" }} />
            <button onClick={exportColisCSV} style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--surface2)", color: "var(--text)", border: "1.5px solid var(--border)", borderRadius: 8, padding: "9px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}><FileStack size={13} /> Exporter les colis (CSV)</button>
            <button onClick={exportColisExcel} style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--surface2)", color: "var(--text)", border: "1.5px solid var(--border)", borderRadius: 8, padding: "9px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}><FileStack size={13} /> Exporter les colis (Excel)</button>
          </div>
        </div>

        <div style={{ background: "var(--surface)", borderRadius: 14, padding: 20, border: "1px solid var(--border)" }}>
          <div style={{ fontWeight: 700, color: "var(--text)", fontSize: 14, marginBottom: 4 }}>Sauvegardes automatiques</div>
          <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 14 }}>Une copie complète est enregistrée automatiquement une fois par jour, conservée 14 jours.</div>
          {backups === null && <div style={{ fontSize: 12.5, color: "var(--muted)" }}>Chargement…</div>}
          {backups !== null && backups.length === 0 && <div style={{ fontSize: 12.5, color: "var(--muted)" }}>Aucune sauvegarde automatique pour le moment — la première sera créée à la prochaine ouverture de l’application.</div>}
          {backups && backups.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {backups.map((key) => {
                const dateStr = key.replace(BACKUP_PREFIX, "");
                return (
                  <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--surface2)", borderRadius: 8, padding: "8px 12px" }}>
                    <span style={{ fontSize: 12.5, color: "var(--text)" }}>{new Date(dateStr).toLocaleDateString("fr-FR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</span>
                    {confirmRestore === key ? (
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => setConfirmRestore(null)} style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 11.5, cursor: "pointer" }}>Annuler</button>
                        <button onClick={() => restaurerBackup(key)} disabled={restoring === key} style={{ background: "var(--brand-solid)", color: "#fff", border: "none", borderRadius: 6, padding: "5px 12px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>{restoring === key ? "Restauration…" : "Confirmer"}</button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmRestore(key)} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 6, padding: "5px 12px", fontSize: 11.5, fontWeight: 700, color: "var(--text)", cursor: "pointer" }}>Restaurer</button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ background: "var(--surface)", borderRadius: 14, padding: 20, border: "1px solid var(--brand-solid)" }}>
          <div style={{ fontWeight: 700, color: "var(--danger-fg)", fontSize: 14, marginBottom: 6 }}>Zone dangereuse</div>
          <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 12 }}>Supprime définitivement tous les colis enregistrés. Cette action est irréversible.</div>
          {!confirmReset ? (
            <button onClick={() => setConfirmReset(true)} style={{ background: "none", border: "1.5px solid var(--brand-solid)", color: "var(--danger-fg)", borderRadius: 8, padding: "8px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>Réinitialiser les colis</button>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={resetColis} style={{ background: "var(--brand-solid)", border: "none", color: "#fff", borderRadius: 8, padding: "8px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>Confirmer la suppression</button>
              <button onClick={() => setConfirmReset(false)} style={{ background: "var(--surface2)", border: "none", color: "var(--muted)", borderRadius: 8, padding: "8px 14px", fontSize: 12.5, cursor: "pointer" }}>Annuler</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Performance par agent — s’appuie sur agentCreation (qui a enregistré le colis), déjà
 * présent sur chaque colis mais jusqu’ici seulement affiché sur les étiquettes/tickets, jamais
 * agrégé nulle part. Complète aussi qui a encaissé chaque paiement (paiements[].par), déjà
 * enregistré mais non plus jamais résumé par personne.
 */
function PerformanceAgentsPage({ data, onBack }) {
  const [periode, setPeriode] = useState("mois");
  const colis = data.colis.filter((c) => c.status !== "Annulé");

  const now = new Date();
  function inPeriod(dateStr) {
    const d = new Date(dateStr);
    if (periode === "semaine") return (now - d) / 86400000 <= 7;
    if (periode === "mois") return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    return true;
  }

  const stats = {};
  function agent(nom) {
    const key = nom && nom.trim() ? nom.trim() : "Non renseigné";
    if (!stats[key]) stats[key] = { nom: key, colisCrees: 0, ca: 0, poids: 0, montantEncaisse: 0, nbPaiements: 0, tempsReponseTotalMin: 0, nbReponses: 0 };
    return stats[key];
  }
  colis.forEach((c) => {
    if (inPeriod(c.createdAt)) {
      const s = agent(c.agentCreation);
      s.colisCrees++; s.ca += c.prix; s.poids += c.poids;
    }
    (c.paiements || []).forEach((p) => {
      if (p.par && p.par !== "Enregistrement initial" && inPeriod(p.date)) {
        const s = agent(p.par);
        s.montantEncaisse += p.montant; s.nbPaiements++;
      }
    });
  });
  // Temps de réponse aux messages clients — délai entre un message du client et la première
  // réponse d’un agent qui le suit. Ne fonctionne que sur les messages envoyés depuis cette
  // mise à jour (les réponses plus anciennes n’avaient pas encore l’agent enregistré dessus).
  (data.clientAccounts || []).forEach((client) => {
    const msgs = client.messages || [];
    msgs.forEach((m, i) => {
      if (m.expediteur !== "client") return;
      const reponse = msgs.slice(i + 1).find((x) => x.expediteur === "staff");
      if (reponse && reponse.par && inPeriod(reponse.date)) {
        const delaiMin = (new Date(reponse.date) - new Date(m.date)) / 60000;
        if (delaiMin >= 0) {
          const s = agent(reponse.par);
          s.tempsReponseTotalMin += delaiMin; s.nbReponses++;
        }
      }
    });
  });
  const lignes = Object.values(stats).sort((a, b) => b.colisCrees - a.colisCrees);
  function formatDelai(min) {
    if (min < 60) return `${Math.round(min)} min`;
    if (min < 1440) return `${(min / 60).toFixed(1)} h`;
    return `${(min / 1440).toFixed(1)} j`;
  }

  return (
    <div>
      <ConfigPageHeader title="Performance des agents" desc="Colis enregistrés, chiffre d’affaires et paiements encaissés, par agent." onBack={onBack} />
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        {[["semaine", "7 derniers jours"], ["mois", "Ce mois-ci"], ["tout", "Depuis le début"]].map(([k, label]) => (
          <button key={k} onClick={() => setPeriode(k)} style={{ padding: "7px 14px", borderRadius: 20, border: "1.5px solid " + (periode === k ? "var(--brand-solid)" : "var(--border)"), background: periode === k ? "var(--brand-solid)" : "var(--surface)", color: periode === k ? "#fff" : "var(--muted)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>{label}</button>
        ))}
      </div>
      {lignes.length === 0 ? (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 30, textAlign: "center", color: "var(--muted)", fontSize: 13.5 }}>Aucune activité sur cette période.</div>
      ) : (
        <div style={{ background: "var(--surface)", borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ background: "var(--surface2)", textAlign: "left" }}>{["Agent", "Colis enregistrés", "Poids total", "CA généré", "Paiements encaissés", "Montant encaissé", "Temps de réponse moyen"].map((h) => <th key={h} style={{ padding: "12px 16px", fontSize: 11.5, color: "var(--muted)", fontWeight: 700 }}>{h}</th>)}</tr></thead>
            <tbody>
              {lignes.map((l) => (
                <tr key={l.nom} style={{ borderTop: "1px solid var(--surface2)" }}>
                  <td style={{ padding: "12px 16px", fontSize: 13.5, color: "var(--text)", fontWeight: 600 }}>{l.nom}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--muted)" }}>{l.colisCrees}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--muted)" }}>{l.poids.toFixed(1)} kg</td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--muted)" }}>{fmt(l.ca, "EUR")}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--muted)" }}>{l.nbPaiements}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--muted)" }}>{fmt(l.montantEncaisse, "EUR")}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--muted)" }}>{l.nbReponses > 0 ? formatDelai(l.tempsReponseTotalMin / l.nbReponses) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 14 }}>Les colis créés avant cette mise à jour n’ont pas d’agent enregistré et apparaissent sous "Non renseigné". De même, le temps de réponse ne peut être calculé que pour les messages envoyés depuis cette mise à jour.</div>
    </div>
  );
}

function UtilisateursPage({ data, persist, notify, onBack, session }) {
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  function addUser(u) { persist({ ...data, users: [...data.users, u], activityLog: pushActivity(data, session, "Compte créé", `${u.prenom} ${u.nom} (${u.role})`) }); notify(`Compte créé pour ${u.prenom} ${u.nom}`); setShowForm(false); }
  function removeUser(id) {
    const u = data.users.find((x) => x.id === id);
    persist({ ...data, users: data.users.filter((u) => u.id !== id), activityLog: pushActivity(data, session, "Compte supprimé", u ? `${u.prenom} ${u.nom}` : id) });
  }
  function saveUser(updated) {
    persist({ ...data, users: data.users.map((u) => (u.id === updated.id ? updated : u)), activityLog: pushActivity(data, session, "Profil utilisateur modifié", `${updated.prenom} ${updated.nom}`) });
    notify(`Profil de ${updated.prenom} ${updated.nom} mis à jour`);
    setEditingUser(null);
  }

  /**
   * Réinitialisation d'un mot de passe du personnel par l'administrateur.
   *
   * Les agents n'ont pas de procédure automatique : leur compte donne accès aux colis, aux
   * paiements et à la comptabilité, et un code envoyé par message serait un point d'entrée de
   * trop. La remise à zéro passe donc par l'administrateur, qui vérifie l'identité de la personne
   * en face de lui. Le nouveau mot de passe est affiché une seule fois, puis n'est plus lisible.
   */
  const [mdpTemporaire, setMdpTemporaire] = useState(null);
  const [utilisateurAReinit, setUtilisateurAReinit] = useState(null);

  async function reinitialiserMotDePasse(u) {
    // Mot de passe provisoire lisible mais imprévisible : 8 caractères sans O/0/I/1 pour éviter
    // les confusions quand l'administrateur le dicte à l'agent.
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const provisoire = Array.from({ length: 8 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
    const identifiants = await creerIdentifiantsMotDePasse(provisoire);
    persist({
      ...data,
      users: data.users.map((x) => (x.id === u.id ? { ...x, ...identifiants } : x)),
      activityLog: pushActivity(data, session, "Mot de passe réinitialisé", `${u.prenom} ${u.nom} (${u.identifiant})`),
    });
    setMdpTemporaire({ identifiant: u.identifiant, nom: `${u.prenom} ${u.nom}`.trim(), motdepasse: provisoire });
  }

  if (editingUser) return <UserProfilePage user={editingUser} onSave={saveUser} onBack={() => setEditingUser(null)} sites={data.sites} />;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18, gap: 12 }}>
        <ConfigPageHeader title="Gestion Utilisateurs" desc="Accès, rôles et permissions de l’équipe." onBack={onBack} />
        {effectivePermission(session, "users.gerer") && <button onClick={() => setShowForm(true)} style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--brand-solid)", color: "#fff", border: "none", borderRadius: 8, padding: "10px 16px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}><Plus size={16} /> Créer un compte</button>}
      </div>
      <div style={{ background: "var(--surface)", borderRadius: 14, boxShadow: "0 2px 10px rgba(10,38,71,0.06)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr style={{ background: "var(--surface2)", textAlign: "left" }}>{["Employé", "Identifiant", "Téléphone", "Rôle", "Destinations", "2FA", ""].map((h) => <th key={h} style={{ padding: "12px 16px", fontSize: 11.5, color: "var(--muted)", fontWeight: 700 }}>{h}</th>)}</tr></thead>
          <tbody>
            {data.users.map((u) => (
              <tr key={u.id} onClick={() => setEditingUser(u)} style={{ borderTop: "1px solid var(--surface2)", cursor: "pointer" }}>
                <td style={{ padding: "12px 16px" }}>
                  <div style={{ fontSize: 13.5, color: "var(--text)", fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>{u.role === "Administrateur" && <Shield size={14} color="#E23F52" />} {u.prenom} {u.nom}</div>
                  <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{u.email}</div>
                </td>
                <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--muted)" }}>{u.identifiant}</td>
                <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--muted)" }}>{u.telephone}</td>
                <td style={{ padding: "12px 16px", fontSize: 13 }}>
                  <span style={{ background: "var(--surface2)", color: "var(--text)", padding: "4px 10px", borderRadius: 20, fontSize: 11.5, fontWeight: 600 }}>{u.role}</span>
                  {u.role !== "Administrateur" && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>{FLAGS[u.paysOperation || "GN"] || ""} basé {(COUNTRIES.find((c) => c.code === (u.paysOperation || "GN"))?.name) || "Guinée"}</div>}
                </td>
                <td style={{ padding: "12px 16px", fontSize: 12.5, color: "var(--muted)" }}>{u.role === "Administrateur" ? "Tous les pays" : (u.paysAutorises?.length ? u.paysAutorises.map((c) => FLAGS[c]).join(" ") : "Tous les pays")}</td>
                <td style={{ padding: "12px 16px", fontSize: 13 }}>{u.twoFA ? <ShieldCheck size={15} color="var(--ok-fg)" /> : "—"}</td>
                <td style={{ padding: "12px 16px", textAlign: "right", whiteSpace: "nowrap" }} onClick={(e) => e.stopPropagation()}>{effectivePermission(session, "users.gerer") && <button onClick={() => setUtilisateurAReinit(u)} title="Réinitialiser le mot de passe" style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", marginInlineEnd: 10 }}><Key size={15} /></button>}{u.id !== session?.id && (data.users || []).filter((x) => x.role === "Administrateur").length > 1 && effectivePermission(session, "users.gerer") && <button onClick={() => removeUser(u.id)} style={{ background: "none", border: "none", color: "var(--danger-fg)", cursor: "pointer" }}><Trash2 size={15} /></button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {utilisateurAReinit && (
        <ConfirmerAction
          titre="Réinitialiser ce mot de passe ?"
          message={`${utilisateurAReinit.prenom} ${utilisateurAReinit.nom} ne pourra plus se connecter avec son mot de passe actuel.`}
          consequence="Un mot de passe provisoire sera affiché une seule fois. Assurez-vous de pouvoir le lui transmettre immédiatement."
          libelleAction="Réinitialiser"
          onConfirmer={() => { reinitialiserMotDePasse(utilisateurAReinit); setUtilisateurAReinit(null); }}
          onAnnuler={() => setUtilisateurAReinit(null)}
        />
      )}

      {mdpTemporaire && (
        <Modal onClose={() => setMdpTemporaire(null)} title="Mot de passe réinitialisé">
          <div style={{ fontSize: 13, color: "var(--text)", marginBottom: 12 }}>
            Communiquez ces informations à <strong>{mdpTemporaire.nom}</strong>. Ce mot de passe ne sera plus affiché.
          </div>
          <div style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px", marginBottom: 12 }}>
            <div style={{ fontSize: 11.5, color: "var(--muted)" }}>Identifiant</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 10 }}>{mdpTemporaire.identifiant}</div>
            <div style={{ fontSize: 11.5, color: "var(--muted)" }}>Mot de passe provisoire</div>
            <div style={{ fontFamily: "monospace", fontSize: 20, fontWeight: 700, color: "var(--brand-on-dark)", letterSpacing: 2 }}>{mdpTemporaire.motdepasse}</div>
          </div>
          <div style={{ fontSize: 11.5, color: "var(--warn-fg)", marginBottom: 14 }}>
            Demandez-lui de le changer dès sa première connexion.
          </div>
          <button onClick={() => setMdpTemporaire(null)} style={{ width: "100%", background: "var(--brand-solid)", color: "#fff", border: "none", borderRadius: 8, padding: "11px 0", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>
            J’ai noté
          </button>
        </Modal>
      )}
      {showForm && <UserForm onClose={() => setShowForm(false)} onSave={addUser} existing={data.users} sites={data.sites} />}
    </div>
  );
}

function UserProfilePage({ user, onSave, onBack, sites }) {
  const [tab, setTab] = useState("profil");
  const [prenom, setPrenom] = useState(user.prenom || "");
  const [nom, setNom] = useState(user.nom || "");
  const [email, setEmail] = useState(user.email || "");
  const [telephone, setTelephone] = useState(user.telephone || "");
  const [role, setRole] = useState(user.role);
  const [paysOperation, setPaysOperation] = useState(user.paysOperation || "GN");
  const [agence, setAgence] = useState(user.agence || "");
  const [paysAutorises, setPaysAutorises] = useState(user.paysAutorises || COUNTRIES.filter((c) => c.code !== "GN").map((c) => c.code));
  const [permissionsOverride, setPermissionsOverride] = useState(user.permissionsOverride || {});
  const isAdmin = role === "Administrateur";
  const totalPermCount = PERMISSIONS_SCHEMA.reduce((s, g) => s + g.permissions.length, 0);

  function toggleCountry(code) {
    setPaysAutorises((list) => (list.includes(code) ? list.filter((c) => c !== code) : [...list, code]));
  }
  /*
   * Changer le pays d'opération réinitialise les destinations à la combinaison logique par
   * défaut : un agent basé en Guinée exporte vers n'importe quel pays, un agent basé à
   * l'étranger (ex. Paris) ne gère par défaut que les colis vers son propre pays — Guinée
   * toujours implicite (voir allowedCountries()). L'administrateur reste libre de cocher
   * d'autres pays ensuite pour lui accorder un accès multi-pays.
   */
  function onChangePaysOperation(code) {
    setPaysOperation(code);
    setAgence("");
    setPaysAutorises(code === "GN" ? COUNTRIES.filter((c) => c.code !== "GN").map((c) => c.code) : [code]);
  }
  function togglePermission(key) {
    const current = effectivePermission({ role, permissionsOverride }, key);
    setPermissionsOverride((o) => ({ ...o, [key]: !current }));
  }
  function toggleGroup(group, enable) {
    const next = { ...permissionsOverride };
    group.permissions.forEach((p) => { next[p.key] = enable; });
    setPermissionsOverride(next);
  }
  function save() {
    onSave({ ...user, prenom, nom, email, telephone, role, paysOperation, agence: role === "Administrateur" || role === "Comptable" ? "" : agence, paysAutorises: isAdmin ? [] : paysAutorises, permissionsOverride: isAdmin ? {} : permissionsOverride });
  }

  return (
    <div>
      <ConfigPageHeader title="Profil utilisateur" desc="Gérez les employés, rôles et permissions de votre entreprise." onBack={onBack} />
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--surface2)", display: "grid", placeItems: "center", fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>ID</div>
        <div>
          <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 18, fontWeight: 700, color: "var(--text)" }}>{prenom.toUpperCase()} {nom.toUpperCase()}</div>
          <div style={{ fontSize: 12.5, color: "var(--muted)" }}>@{user.identifiant} · {email}</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 24, borderBottom: "1px solid var(--border)", marginBottom: 22 }}>
        <button onClick={() => setTab("profil")} style={{ background: "none", border: "none", padding: "0 0 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: tab === "profil" ? "var(--info-fg)" : "var(--muted)", borderBottom: tab === "profil" ? "2px solid #5B8DEF" : "2px solid transparent", fontSize: 13.5, fontWeight: 600 }}><User size={14} /> Profil</button>
        <button onClick={() => setTab("permissions")} style={{ background: "none", border: "none", padding: "0 0 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: tab === "permissions" ? "var(--info-fg)" : "var(--muted)", borderBottom: tab === "permissions" ? "2px solid #5B8DEF" : "2px solid transparent", fontSize: 13.5, fontWeight: 600 }}><Lock size={14} /> Permissions <span style={{ background: "var(--surface2)", color: "var(--muted)", borderRadius: 12, padding: "1px 7px", fontSize: 11 }}>{totalPermCount}</span></button>
      </div>

      {tab === "profil" ? (
        <div style={{ maxWidth: 460 }}>
          <Field label="Prénom"><input value={prenom} onChange={(e) => setPrenom(e.target.value)} style={inputStyle} /></Field>
          <Field label="Nom"><input value={nom} onChange={(e) => setNom(e.target.value)} style={inputStyle} /></Field>
          <Field label="Email"><input value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} /></Field>
          <Field label="Identifiant"><input value={user.identifiant} disabled style={{ ...inputStyle, opacity: 0.6 }} /></Field>
          <Field label="Téléphone"><PhoneInput value={telephone} onChange={setTelephone} /></Field>
          <Field label="Rôle">
            <select value={role} onChange={(e) => setRole(e.target.value)} disabled={user.identifiant === "admin"} style={inputStyle}>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>
          {!isAdmin && (
            <Field label="Pays d’opération">
              <select value={paysOperation} onChange={(e) => onChangePaysOperation(e.target.value)} style={inputStyle}>
                {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{FLAGS[c.code] || ""} {c.name}</option>)}
              </select>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                Pays où travaille cette personne — son point expéditeur. Détermine l’agence qu’elle peut choisir et les destinations proposées par défaut.
              </div>
            </Field>
          )}
          {(role === "Agent" || role === "Chauffeur") && (
            <Field label="Agence assignée">
              <select value={agence} onChange={(e) => setAgence(e.target.value)} style={inputStyle}>
                <option value="">Toutes les agences (aucune restriction)</option>
                {sitesPourPays(sites, paysOperation).map((s) => <option key={s.id || s.nom} value={s.nom}>{s.nom}</option>)}
              </select>
            </Field>
          )}

          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", margin: "18px 0 8px" }}>PAYS DE DESTINATION AUTORISÉS</div>
          {isAdmin ? (
            <div style={{ background: "var(--surface2)", borderRadius: 8, padding: "10px 12px", fontSize: 13, color: "var(--text)" }}>🌍 Tous les pays (Administrateur)</div>
          ) : (
            <>
              <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 8 }}>
                Guinée toujours incluse. Par défaut, seul le pays d’opération ci-dessus est proposé — cochez-en d’autres pour autoriser un accès multi-pays.
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))", gap: 8, marginBottom: 8 }}>
                {COUNTRIES.filter((c) => c.code !== "GN").map((c) => (
                  <label key={c.code} style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--surface2)", borderRadius: 8, padding: "8px 10px", cursor: "pointer", fontSize: 12.5, color: "var(--text)" }}>
                    <input type="checkbox" checked={paysAutorises.includes(c.code)} onChange={() => toggleCountry(c.code)} />
                    {FLAGS[c.code]} {c.name}
                  </label>
                ))}
              </div>
            </>
          )}
          {!isAdmin && paysAutorises.length === 0 && <div style={{ fontSize: 11.5, color: "var(--warn-fg)", marginBottom: 8 }}>Aucun pays coché = accès à tous les pays par défaut.</div>}

          <button onClick={save} style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 8, background: "#3D63FF", color: "#fff", border: "none", borderRadius: 8, padding: "11px 22px", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>
            Enregistrer
          </button>
        </div>
      ) : (
        <div style={{ maxWidth: 560 }}>
          {isAdmin ? (
            <div style={{ background: "var(--surface2)", borderRadius: 8, padding: "10px 12px", fontSize: 13, color: "var(--text)", marginBottom: 16 }}>🔓 Accès complet — les administrateurs disposent automatiquement de toutes les permissions.</div>
          ) : (
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16 }}>
              Permissions héritées du rôle <strong style={{ color: "var(--text)" }}>{role}</strong>. Les modifications individuelles sont marquées d’un point <span style={{ color: "var(--info-fg)" }}>●</span>.
            </div>
          )}
          {PERMISSIONS_SCHEMA.map((g) => {
            const enabledCount = g.permissions.filter((p) => effectivePermission({ role, permissionsOverride }, p.key)).length;
            return (
              <div key={g.group} style={{ border: "1px solid var(--border)", borderRadius: 12, marginBottom: 14, overflow: "hidden" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", background: "var(--surface2)" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", letterSpacing: 0.5 }}>{g.group}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>{enabledCount}/{g.permissions.length}</span>
                    {!isAdmin && (
                      <button onClick={() => toggleGroup(g, enabledCount < g.permissions.length)} style={{ width: 38, height: 22, borderRadius: 20, border: "none", background: enabledCount === g.permissions.length ? "#3ECB84" : "var(--surface)", position: "relative", cursor: "pointer", flexShrink: 0 }}>
                        <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: enabledCount === g.permissions.length ? 19 : 3, transition: "left 0.15s" }} />
                      </button>
                    )}
                  </div>
                </div>
                {g.permissions.map((p) => {
                  const on = isAdmin ? true : effectivePermission({ role, permissionsOverride }, p.key);
                  const overridden = !isAdmin && permissionsOverride && Object.prototype.hasOwnProperty.call(permissionsOverride, p.key) && permissionsOverride[p.key] !== (ROLE_DEFAULT_PERMISSIONS[role] || []).includes(p.key);
                  return (
                    <div key={p.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", borderTop: "1px solid var(--border)" }}>
                      <div style={{ fontSize: 13, color: "var(--text)", display: "flex", alignItems: "center", gap: 6 }}>{p.label} {overridden && <span style={{ color: "var(--info-fg)", fontSize: 16, lineHeight: 0 }}>●</span>}</div>
                      <button onClick={() => !isAdmin && togglePermission(p.key)} disabled={isAdmin} style={{ width: 38, height: 22, borderRadius: 20, border: "none", background: on ? "#3ECB84" : "var(--surface2)", position: "relative", cursor: isAdmin ? "default" : "pointer", flexShrink: 0, opacity: isAdmin ? 0.6 : 1 }}>
                        <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: on ? 19 : 3, transition: "left 0.15s" }} />
                      </button>
                    </div>
                  );
                })}
              </div>
            );
          })}
          {!isAdmin && (
            <button onClick={save} style={{ display: "flex", alignItems: "center", gap: 8, background: "#3D63FF", color: "#fff", border: "none", borderRadius: 8, padding: "11px 22px", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>
              Enregistrer
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function UserForm({ onClose, onSave, existing, sites }) {
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [telephone, setTelephone] = useState("");
  const [identifiant, setIdentifiant] = useState("");
  const [motdepasse, setMotdepasse] = useState("");
  const [role, setRole] = useState("Agent");
  const [paysOperation, setPaysOperation] = useState("GN");
  const [agence, setAgence] = useState("");
  const [twoFA, setTwoFA] = useState(false);
  const [paysAutorises, setPaysAutorises] = useState(COUNTRIES.filter((c) => c.code !== "GN").map((c) => c.code));
  const [err, setErr] = useState("");
  const [showPw, setShowPw] = useState(false);
  function toggleCountry(code) {
    setPaysAutorises((list) => (list.includes(code) ? list.filter((c) => c !== code) : [...list, code]));
  }
  // Cf. UserProfilePage : changer le pays d'opération recalcule les destinations par défaut.
  function onChangePaysOperation(code) {
    setPaysOperation(code);
    setAgence("");
    setPaysAutorises(code === "GN" ? COUNTRIES.filter((c) => c.code !== "GN").map((c) => c.code) : [code]);
  }
  async function submit(e) {
    e.preventDefault();
    if (!prenom || !nom || !email || !telephone || !identifiant || !motdepasse) { setErr("Merci de renseigner tous les champs."); return; }
    if (!/^\S+@\S+\.\S+$/.test(email)) { setErr("Adresse email invalide."); return; }
    if (existing.some((u) => u.identifiant === identifiant.trim())) { setErr("Cet identifiant existe déjà."); return; }
    const identifiants = await creerIdentifiantsMotDePasse(motdepasse);
    onSave({ id: `u${Date.now()}`, prenom, nom, email: email.trim(), telephone, identifiant: identifiant.trim(), ...identifiants, role, paysOperation, agence: role === "Administrateur" || role === "Comptable" ? "" : agence, twoFA, paysAutorises: role === "Administrateur" ? [] : paysAutorises });
  }
  return (
    <Modal onClose={onClose} title="Créer un compte utilisateur">
      <form onSubmit={submit} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
        <Field label="Prénom"><input value={prenom} onChange={(e) => setPrenom(e.target.value)} style={inputStyle} /></Field>
        <Field label="Nom"><input value={nom} onChange={(e) => setNom(e.target.value)} style={inputStyle} /></Field>
        <div style={{ gridColumn: "1 / -1" }}>
          <Field label="Adresse email"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} placeholder="nom@badiaby-express.com" /></Field>
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <Field label="Numéro de téléphone"><PhoneInput value={telephone} onChange={setTelephone} /></Field>
        </div>
        <Field label="Identifiant"><input value={identifiant} onChange={(e) => setIdentifiant(e.target.value)} style={inputStyle} /></Field>
        <Field label="Mot de passe">
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type={showPw ? "text" : "password"} autoComplete="new-password" value={motdepasse} onChange={(e) => setMotdepasse(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
            <button type="button" onClick={() => setShowPw((s) => !s)} title={showPw ? "Masquer le mot de passe" : "Afficher le mot de passe"} style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, width: 34, height: 34, cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0 }}>
              {showPw ? <EyeOff size={14} color="var(--muted)" /> : <Eye size={14} color="var(--muted)" />}
            </button>
          </div>
        </Field>
        <div style={{ gridColumn: "1 / -1" }}>
          <Field label="Rôle"><select value={role} onChange={(e) => setRole(e.target.value)} style={inputStyle}>{ROLES.map((r) => <option key={r} value={r}>{r}</option>)}</select></Field>
        </div>
        {role !== "Administrateur" && (
          <div style={{ gridColumn: "1 / -1" }}>
            <Field label="Pays d’opération">
              <select value={paysOperation} onChange={(e) => onChangePaysOperation(e.target.value)} style={inputStyle}>
                {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{FLAGS[c.code] || ""} {c.name}</option>)}
              </select>
            </Field>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: -8, marginBottom: 10 }}>Pays où travaille cette personne — son point expéditeur. Détermine l’agence proposée et les destinations autorisées par défaut.</div>
          </div>
        )}
        {(role === "Agent" || role === "Chauffeur") && (
          <div style={{ gridColumn: "1 / -1" }}>
            <Field label="Agence assignée">
              <select value={agence} onChange={(e) => setAgence(e.target.value)} style={inputStyle}>
                <option value="">Toutes les agences (aucune restriction)</option>
                {sitesPourPays(sites, paysOperation).map((s) => <option key={s.id || s.nom} value={s.nom}>{s.nom}</option>)}
              </select>
            </Field>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: -8, marginBottom: 10 }}>Si une agence est choisie, cet utilisateur ne verra que les colis, statistiques et bordereaux de cette agence.</div>
          </div>
        )}
        {role !== "Administrateur" && (
          <div style={{ gridColumn: "1 / -1" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: 4 }}>Pays de destination autorisés</div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8 }}>Guinée toujours incluse. Cochez d’autres pays pour autoriser un accès multi-pays.</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(130px,1fr))", gap: 8, marginBottom: 8 }}>
              {COUNTRIES.filter((c) => c.code !== "GN").map((c) => (
                <label key={c.code} style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--surface2)", borderRadius: 8, padding: "6px 9px", cursor: "pointer", fontSize: 12, color: "var(--text)" }}>
                  <input type="checkbox" checked={paysAutorises.includes(c.code)} onChange={() => toggleCountry(c.code)} />
                  {FLAGS[c.code]} {c.name}
                </label>
              ))}
            </div>
          </div>
        )}
        <label style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text)", margin: "-6px 0 8px", cursor: "pointer" }}>
          <input type="checkbox" checked={twoFA} onChange={(e) => setTwoFA(e.target.checked)} /> Activer la double authentification (démo)
        </label>
        {err && <div style={{ gridColumn: "1 / -1", color: "var(--danger-fg)", fontSize: 12.5, marginBottom: 4 }}>{err}</div>}
        <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button type="button" onClick={onClose} style={{ padding: "10px 18px", borderRadius: 8, border: "1.5px solid var(--border)", background: "var(--surface)", color: "var(--muted)", fontSize: 13.5, cursor: "pointer" }}>Annuler</button>
          <button type="submit" style={{ padding: "10px 18px", borderRadius: 8, border: "none", background: "var(--brand-solid)", color: "#fff", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>Créer le compte</button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Fenêtre modale.
 *
 * `niveau` permet d'empiler une fenêtre par-dessus une autre. Sans lui, une seconde fenêtre
 * ouverte depuis la première (par exemple la remise depuis la fiche colis) partageait le même
 * niveau : selon l'ordre de rendu, la fiche pouvait recouvrir la remise et rendre ses boutons
 * inaccessibles — l'agent voyait la fenêtre mais ne pouvait pas cliquer dedans.
 */
/**
 * Confirmation avant une action irréversible.
 *
 * Plusieurs suppressions s'exécutaient au premier clic : catégorie, site d'opération, dépense,
 * pré-alerte, réinitialisation de mot de passe. Sur téléphone, l'icône corbeille est petite et
 * voisine d'autres boutons — un doigt qui glisse effaçait une donnée sans retour possible.
 *
 * Un composant unique plutôt que cinq fenêtres différentes : le geste est le même partout, et
 * les prochaines suppressions ajoutées hériteront du même filet.
 */
function ConfirmerAction({ titre, message, consequence, libelleAction = "Supprimer", onConfirmer, onAnnuler }) {
  return (
    <Modal onClose={onAnnuler} title={titre} niveau={1}>
      <div style={{ fontSize: 13.5, color: "var(--text)", marginBottom: consequence ? 12 : 18 }}>{message}</div>
      {consequence && (
        <div style={{ background: "var(--warn-bg)", border: "1px solid var(--warn-border)", borderRadius: 8, padding: "11px 13px", marginBottom: 18 }}>
          <div style={{ fontSize: 12.5, color: "var(--text)", lineHeight: 1.55 }}>{consequence}</div>
        </div>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onConfirmer}
          style={{ flex: 1, background: "var(--brand-solid)", color: "#fff", border: "none", borderRadius: 8, padding: "11px 0", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>
          {libelleAction}
        </button>
        <button onClick={onAnnuler}
          style={{ background: "none", border: "1px solid var(--border)", color: "var(--muted)", borderRadius: 8, padding: "11px 20px", fontSize: 13, cursor: "pointer" }}>
          Annuler
        </button>
      </div>
    </Modal>
  );
}

function Modal({ title, children, onClose, wide, niveau = 0, saisieEnCours = false }) {
  const [confirmerFermeture, setConfirmerFermeture] = useState(false);

  /*
   * Fermeture protégée.
   *
   * Un clic à côté de la fenêtre suffisait à tout perdre. Sur un formulaire de colis rempli
   * pendant plusieurs minutes, avec le client en face, c'est le genre de détail qui fait
   * détester un outil. Quand une saisie est en cours, on demande confirmation.
   *
   * La touche Échap ferme aussi la fenêtre : les agents habitués au clavier la cherchent.
   */
  function demanderFermeture() {
    if (saisieEnCours) setConfirmerFermeture(true);
    else onClose();
  }

  useEffect(() => {
    function surTouche(e) {
      if (e.key === "Escape" && !confirmerFermeture) { e.stopPropagation(); demanderFermeture(); }
    }
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [saisieEnCours, confirmerFermeture]);

  return (
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) demanderFermeture(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(4,7,14,0.65)", display: "grid", placeItems: "center", zIndex: 50 + niveau * 10, padding: 12 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 20, width: wide ? "min(94vw, 620px)" : "min(94vw, 420px)", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 24px 60px rgba(0,0,0,0.5)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 17, color: TEXT }}>{title}</div>
          <button onClick={demanderFermeture} style={{ background: SURFACE2, border: "none", borderRadius: 8, width: 28, height: 28, cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0 }}><X size={15} color={MUTED} /></button>
        </div>
        {children}

        {confirmerFermeture && (
          <div onClick={(e) => e.stopPropagation()}
            style={{ position: "fixed", inset: 0, background: "rgba(4,7,14,0.75)", display: "grid", placeItems: "center", zIndex: 200, padding: 14 }}>
            <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 22, width: "100%", maxWidth: 380 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: TEXT, marginBottom: 6 }}>Abandonner la saisie ?</div>
              <div style={{ fontSize: 12.5, color: MUTED, marginBottom: 18, lineHeight: 1.55 }}>
                Les informations saisies seront perdues.
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => { setConfirmerFermeture(false); onClose(); }}
                  style={{ flex: 1, background: "var(--brand-solid)", color: "#fff", border: "none", borderRadius: 8, padding: "11px 0", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>
                  Abandonner
                </button>
                <button onClick={() => setConfirmerFermeture(false)}
                  style={{ background: "none", border: `1px solid ${BORDER}`, color: MUTED, borderRadius: 8, padding: "11px 20px", fontSize: 13, cursor: "pointer" }}>
                  Continuer la saisie
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error("Ba-Diaby Express — erreur interceptée :", error, info); }
  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--surface2)", fontFamily: "'Inter',sans-serif", padding: 24 }}>
          <div style={{ background: "var(--surface)", borderRadius: 14, padding: 28, maxWidth: 420, boxShadow: "0 24px 60px rgba(10,38,71,0.2)" }}>
            <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 18, color: "var(--danger-fg)", marginBottom: 8 }}>Une erreur est survenue</div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>L’application a rencontré un problème inattendu. Détail technique :</div>
            <div style={{ background: "var(--surface2)", borderRadius: 8, padding: 12, fontSize: 12, color: "var(--text)", fontFamily: "monospace", marginBottom: 16, wordBreak: "break-word" }}>{String(this.state.error?.message || this.state.error)}</div>
            <button onClick={() => this.setState({ error: null })} style={{ width: "100%", background: "var(--brand-solid)", color: "#fff", border: "none", borderRadius: 8, padding: "11px 0", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Réessayer</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function AppWithBoundary() {
  return <ErrorBoundary><App /></ErrorBoundary>;
}
