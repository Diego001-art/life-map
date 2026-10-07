# Модель героя (GLB)

Сейчас герой собирается кодом (`src/character/rig.js`) — это «временная» (placeholder) модель со скелетом.
Чтобы заменить её настоящей 3D-моделью, положите сюда файл **`player.glb`** — игра подхватит его сама.

## Требования к player.glb
- Формат glTF 2.0 / GLB, один файл: меш, материалы (PBR), текстуры, скелет, скиннинг, анимации.
- Кости с именами: `Hips, Spine, Spine1, Spine2, Neck, Head, LeftShoulder, LeftArm, LeftForeArm, LeftHand,
  RightShoulder, RightArm, RightForeArm, RightHand, LeftUpLeg, LeftLeg, LeftFoot, RightUpLeg, RightLeg, RightFoot`
  (пальцы — по желанию). Персонаж смотрит вдоль +Z, высота ~1.85 м, ступни на нуле.
- Анимации «на месте» (in-place) с точными названиями:
  `Idle, Walk, Run, Sprint, JumpStart, JumpLoop, JumpFall, Land, Crouch, CrouchWalk, Dodge, Roll,
  LightAttack1, LightAttack2, LightAttack3, HeavyAttack, SpinAttack, DaggerAttack, Block, Parry,
  HitFront, HitBack, HitLeft, HitRight, Death, Interact, Pickup, Climb, ClimbDown`.
  Каких клипов нет в файле — игра возьмёт встроенные (они работают по тем же именам костей).
- Сокеты оружия (пустые объекты): `RightHandSocket` (в правой кисти), `BeltWeaponSocket` (пояс), `BackWeaponSocket` (спина).
  Если их нет — игра создаст их сама на костях RightHand / Spine / Spine2.
- Бюджет: LOD0 30–50 тыс. треугольников, текстуры 2048×2048 (BaseColor, Normal, Roughness/Metallic, AO).

Посмотреть модель и все анимации без игры: откройте `preview/character.html`.
