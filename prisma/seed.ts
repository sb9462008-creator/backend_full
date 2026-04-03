import "dotenv/config";

import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

import { env } from "../src/common/utils/env";

const prisma = new PrismaClient();

async function main() {
  const slug = "demo-company";
  const adminEmail = "admin@hurgelt.local";
  const customerEmail = "customer@hurgelt.local";
  const driverEmail = "driver@hurgelt.local";
  const trackingCode = "TRACK-DEMO-1001";
  const driverMissionTrackingCode = "TRACK-DRIVER-1002";

  const tenant = await prisma.tenant.upsert({
    where: { slug },
    update: {},
    create: {
      name: "Demo Company",
      slug,
    },
  });

  const existing = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!existing) {
    await prisma.user.create({
      data: {
        tenantId: tenant.id,
        name: "Demo Admin",
        email: adminEmail,
        passwordHash: await bcrypt.hash("password123", 10),
        role: UserRole.COMPANY_ADMIN,
      },
    });
  }

  const existingCustomer = await prisma.user.findUnique({
    where: { email: customerEmail },
  });

  if (!existingCustomer) {
    await prisma.user.create({
      data: {
        tenantId: tenant.id,
        name: "Demo Customer",
        email: customerEmail,
        passwordHash: await bcrypt.hash("password123", 10),
        role: UserRole.CUSTOMER,
      },
    });
  }

  const existingDriver = await prisma.user.findUnique({
    where: { email: driverEmail },
  });

  if (!existingDriver) {
    await prisma.user.create({
      data: {
        tenantId: tenant.id,
        name: "Demo Driver",
        email: driverEmail,
        passwordHash: await bcrypt.hash("password123", 10),
        role: UserRole.DRIVER,
      },
    });
  }

  const admin = await prisma.user.findUniqueOrThrow({
    where: { email: adminEmail },
  });

  const driverUser = await prisma.user.findUniqueOrThrow({
    where: { email: driverEmail },
  });

  const products = [
    {
      sku: "CPU-RYZEN7-7800X3D",
      slug: "amd-ryzen-7-7800x3d",
      name: "AMD Ryzen 7 7800X3D",
      category: "CPU",
      brand: "AMD",
      description: "8 цөмтэй, өндөр үр ашигтай, gaming гүйцэтгэл сайтай процессор.",
      priceCents: 38900,
      stock: 12,
      imageUrl: "https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?auto=format&fit=crop&w=900&q=80",
    },
    {
      sku: "GPU-RTX-4070-SUPER",
      slug: "nvidia-geforce-rtx-4070-super",
      name: "NVIDIA GeForce RTX 4070 SUPER",
      category: "GPU",
      brand: "NVIDIA",
      description: "Ray tracing болон DLSS дэмждэг, 1440p ангиллын өндөр гүйцэтгэлтэй видео карт.",
      priceCents: 59900,
      stock: 8,
      imageUrl: "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?auto=format&fit=crop&w=900&q=80",
    },
    {
      sku: "MB-B650-TOMAHAWK",
      slug: "msi-mag-b650-tomahawk",
      name: "MSI MAG B650 Tomahawk WiFi",
      category: "MOTHERBOARD",
      brand: "MSI",
      description: "Wi‑Fi, хүчирхэг VRM хөргөлт, орчин үеийн оролт гаралттай AM5 эх хавтан.",
      priceCents: 23900,
      stock: 10,
      imageUrl: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=900&q=80",
    },
    {
      sku: "RAM-DDR5-32GB-6000",
      slug: "corsair-ddr5-32gb-6000",
      name: "Corsair Vengeance DDR5 32GB 6000MHz",
      category: "RAM",
      brand: "Corsair",
      description: "Орчин үеийн gaming болон бүтээлч ажлын build-д тохирсон 32GB dual-channel DDR5 санах ой.",
      priceCents: 12900,
      stock: 16,
      imageUrl: "https://images.unsplash.com/photo-1562976540-1502c2145186?auto=format&fit=crop&w=900&q=80",
    },
    {
      sku: "SSD-990PRO-2TB",
      slug: "samsung-990-pro-2tb",
      name: "Samsung 990 PRO 2TB",
      category: "SSD",
      brand: "Samsung",
      description: "Үйлдлийн систем, тоглоом, төслийн файлуудад зориулсан хурдан PCIe 4.0 NVMe SSD.",
      priceCents: 17900,
      stock: 20,
      imageUrl: "https://images.unsplash.com/photo-1591488320449-011701bb6704?auto=format&fit=crop&w=900&q=80",
    },
    {
      sku: "PSU-RM850X",
      slug: "corsair-rm850x",
      name: "Corsair RM850x",
      category: "POWER_SUPPLY",
      brand: "Corsair",
      description: "Өндөр гүйцэтгэлтэй системд тохирох найдвартай 850W бүрэн modular тэжээлийн блок.",
      priceCents: 14900,
      stock: 14,
      imageUrl: "https://images.unsplash.com/photo-1587202372616-b43abea06c2a?auto=format&fit=crop&w=900&q=80",
    },
    {
      sku: "CPU-I7-14700KF",
      slug: "intel-core-i7-14700kf",
      name: "Intel Core i7-14700KF",
      category: "CPU",
      brand: "Intel",
      description: "Өндөр refresh-rate gaming болон олон даалгаварт зориулсан 20 цөмт desktop процессор.",
      priceCents: 42900,
      stock: 9,
      imageUrl: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=900&q=80",
    },
    {
      sku: "GPU-RTX-4060-TI",
      slug: "nvidia-geforce-rtx-4060-ti",
      name: "NVIDIA GeForce RTX 4060 Ti",
      category: "GPU",
      brand: "NVIDIA",
      description: "Esports болон өдөр тутмын creator хэрэглээнд тохирсон 1080p, entry-level 1440p видео карт.",
      priceCents: 42900,
      stock: 11,
      imageUrl: "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?auto=format&fit=crop&w=900&q=80",
    },
    {
      sku: "COOLER-GALAHAD-360",
      slug: "lian-li-galahad-ii-trinity-360",
      name: "Lian Li Galahad II Trinity 360",
      category: "COOLER",
      brand: "Lian Li",
      description: "Дээд зэрэглэлийн gaming build-д зориулсан 360мм AIO шингэн хөргөлт.",
      priceCents: 19900,
      stock: 7,
      imageUrl: "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?auto=format&fit=crop&w=900&q=80",
    },
    {
      sku: "CASE-NZXT-H6FLOW",
      slug: "nzxt-h6-flow-rgb",
      name: "NZXT H6 Flow RGB",
      category: "CASE",
      brand: "NZXT",
      description: "Панорам шилэн хийц, сайн агаарын урсгал, RGB-д бэлэн дотоод зохион байгуулалттай dual-chamber кейс.",
      priceCents: 16900,
      stock: 13,
      imageUrl: "https://images.unsplash.com/photo-1545239351-1141bd82e8a6?auto=format&fit=crop&w=900&q=80",
    },
    {
      sku: "MON-LG-27GR95QE",
      slug: "lg-ultragear-27gr95qe-oled",
      name: "LG UltraGear 27GR95QE OLED",
      category: "MONITOR",
      brand: "LG",
      description: "240Hz сэргэлтийн давтамж, маш хурдан хариу үйлдэлтэй 27 инчийн QHD OLED gaming дэлгэц.",
      priceCents: 89900,
      stock: 6,
      imageUrl: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=900&q=80",
    },
    {
      sku: "MON-ASUS-VG27AQ3A",
      slug: "asus-tuf-vg27aq3a",
      name: "ASUS TUF VG27AQ3A",
      category: "MONITOR",
      brand: "ASUS",
      description: "180Hz сэргэлтийн давтамжтай, хөдөлгөөний дүрслэл тод, өдөр тутмын хэрэглээнд тохирсон 27 инчийн QHD IPS дэлгэц.",
      priceCents: 32900,
      stock: 15,
      imageUrl: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=900&q=80",
    },
    {
      sku: "MON-ZOWIE-XL2566K",
      slug: "benq-zowie-xl2566k",
      name: "BenQ ZOWIE XL2566K",
      category: "MONITOR",
      brand: "ZOWIE",
      description: "Өрсөлдөөнт shooter тоглоомд зориулсан 24.5 инчийн 360Hz esports дэлгэц.",
      priceCents: 67900,
      stock: 7,
      imageUrl: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=900&q=80",
    },
    {
      sku: "PC-AURORA-1440P",
      slug: "aurora-1440p-gaming-pc",
      name: "Aurora 1440p Gaming PC",
      category: "PC_BUILD",
      brand: "XADE Builds",
      description: "Ryzen 7 болон RTX ангиллын тохиргоотой, 1440p дээр жигд тоглох бэлэн gaming компьютер.",
      priceCents: 189900,
      stock: 4,
      imageUrl: "https://images.unsplash.com/photo-1598550476439-6847785fcea6?auto=format&fit=crop&w=900&q=80",
    },
    {
      sku: "PC-TITAN-CREATOR",
      slug: "titan-creator-workstation",
      name: "Titan Creator Workstation",
      category: "PC_BUILD",
      brand: "XADE Builds",
      description: "Видео засвар, 3D, стрийм болон хүнд multitasking-д зориулсан өндөр санах ойтой workstation.",
      priceCents: 249900,
      stock: 3,
      imageUrl: "https://images.unsplash.com/photo-1587202372634-32705e3bf49c?auto=format&fit=crop&w=900&q=80",
    },
    {
      sku: "PC-NEBULA-ESPORTS",
      slug: "nebula-esports-pc",
      name: "Nebula Esports PC",
      category: "PC_BUILD",
      brand: "XADE Builds",
      description: "Цэвэр cable management, нам гүм хөргөлттэй, өндөр FPS гаргах авсаархан esports компьютер.",
      priceCents: 149900,
      stock: 5,
      imageUrl: "https://images.unsplash.com/photo-1593305841991-05c297ba4575?auto=format&fit=crop&w=900&q=80",
    },
    {
      sku: "RAM-DDR5-64GB-6400",
      slug: "gskill-trident-z5-64gb-6400",
      name: "G.Skill Trident Z5 RGB 64GB 6400MHz",
      category: "RAM",
      brand: "G.Skill",
      description: "Топ түвшний gaming, стрийм, workstation хэрэглээнд зориулсан өндөр багтаамжтай DDR5 санах ой.",
      priceCents: 24900,
      stock: 10,
      imageUrl: "https://images.unsplash.com/photo-1562976540-1502c2145186?auto=format&fit=crop&w=900&q=80",
    },
    {
      sku: "SSD-SN850X-4TB",
      slug: "wd-black-sn850x-4tb",
      name: "WD Black SN850X 4TB",
      category: "SSD",
      brand: "Western Digital",
      description: "Их хэмжээний тоглоомын сан болон бүтээлч төслийн файлуудад зориулсан өндөр багтаамжтай PCIe 4.0 SSD.",
      priceCents: 28900,
      stock: 8,
      imageUrl: "https://images.unsplash.com/photo-1591488320449-011701bb6704?auto=format&fit=crop&w=900&q=80",
    },
    {
      sku: "MOUSE-GPROX2",
      slug: "logitech-g-pro-x-superlight-2",
      name: "Logitech G Pro X Superlight 2",
      category: "MOUSE",
      brand: "Logitech G",
      description: "HERO мэдрэгчтэй, маш хөнгөн, бага хоцрогдолтой wireless esports хулгана.",
      priceCents: 18900,
      stock: 18,
      imageUrl: "https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?auto=format&fit=crop&w=900&q=80",
    },
    {
      sku: "MOUSE-VIPER-V3",
      slug: "razer-viper-v3-pro",
      name: "Razer Viper V3 Pro",
      category: "MOUSE",
      brand: "Razer",
      description: "Хурдан aim control болон өрсөлдөөнт tracking-д зориулсан дээд зэрэглэлийн хөнгөн wireless хулгана.",
      priceCents: 19900,
      stock: 14,
      imageUrl: "https://images.unsplash.com/photo-1527814050087-3793815479db?auto=format&fit=crop&w=900&q=80",
    },
    {
      sku: "KB-WOOTING-60HE",
      slug: "wooting-60he",
      name: "Wooting 60HE",
      category: "KEYBOARD",
      brand: "Wooting",
      description: "Analog input болон rapid trigger дэмждэг, FPS тоглоомд тохирсон Hall-effect gaming гар.",
      priceCents: 24900,
      stock: 9,
      imageUrl: "https://images.unsplash.com/photo-1511467687858-23d96c32e4ae?auto=format&fit=crop&w=900&q=80",
    },
    {
      sku: "KB-ASUS-AZOTH",
      slug: "asus-rog-azoth",
      name: "ASUS ROG Azoth",
      category: "KEYBOARD",
      brand: "ASUS",
      description: "75% хэмжээтэй, авсаархан gaming layout болон чанартай хийцтэй wireless mechanical гар.",
      priceCents: 28900,
      stock: 8,
      imageUrl: "https://images.unsplash.com/photo-1517430816045-df4b7de11d1d?auto=format&fit=crop&w=900&q=80",
    },
    {
      sku: "PAD-ARTISAN-ZERO",
      slug: "artisan-zero-soft-xl",
      name: "Artisan Zero Soft XL",
      category: "MOUSEPAD",
      brand: "Artisan",
      description: "Өрсөлдөөнт тоглолтод зориулсан тогтвортой glide, оёдолтой ирмэгтэй premium control mousepad.",
      priceCents: 7900,
      stock: 20,
      imageUrl: "https://images.unsplash.com/photo-1587033411391-5d9e51cce126?auto=format&fit=crop&w=900&q=80",
    },
    {
      sku: "PAD-ZOWIE-GSRSE",
      slug: "zowie-g-sr-se-rouge",
      name: "ZOWIE G-SR-SE Rouge II",
      category: "MOUSEPAD",
      brand: "ZOWIE",
      description: "Тактик shooter тоглоомд тохирох, тэнцвэртэй хурд ба control бүхий smooth cloth mousepad.",
      priceCents: 5900,
      stock: 22,
      imageUrl: "https://images.unsplash.com/photo-1616788494707-ec28f08d05a1?auto=format&fit=crop&w=900&q=80",
    },
    {
      sku: "CPU-RYZEN9-9950X3D",
      slug: "amd-ryzen-9-9950x3d",
      name: "AMD Ryzen 9 9950X3D",
      category: "CPU",
      brand: "AMD",
      description: "High-end gaming болон workstation хэрэглээнд зориулсан дээд ангиллын X3D процессор.",
      priceCents: 69900,
      stock: 18,
      imageUrl: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=900&q=80",
    },
    {
      sku: "GPU-RTX-5080",
      slug: "nvidia-geforce-rtx-5080",
      name: "NVIDIA GeForce RTX 5080",
      category: "GPU",
      brand: "NVIDIA",
      description: "4K gaming болон AI-accelerated creator workflow-д зориулсан дээд зэрэглэлийн GPU.",
      priceCents: 129900,
      stock: 12,
      imageUrl: "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?auto=format&fit=crop&w=900&q=80",
    },
    {
      sku: "MB-X870E-CARBON",
      slug: "msi-mpg-x870e-carbon-wifi",
      name: "MSI MPG X870E Carbon WiFi",
      category: "MOTHERBOARD",
      brand: "MSI",
      description: "Premium AM5 эх хавтан, хурдан I/O болон тогтвортой тэжээлийн шийдэлтэй.",
      priceCents: 42900,
      stock: 16,
      imageUrl: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=900&q=80",
    },
    {
      sku: "COOLER-AK620-DIGITAL",
      slug: "deepcool-ak620-digital",
      name: "DeepCool AK620 Digital",
      category: "COOLER",
      brand: "DeepCool",
      description: "Хүчтэй dual-tower агаарын хөргөлт, температурын дэлгэцтэй premium cooler.",
      priceCents: 12900,
      stock: 20,
      imageUrl: "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?auto=format&fit=crop&w=900&q=80",
    },
    {
      sku: "CASE-FRACTAL-NORTHXL",
      slug: "fractal-design-north-xl",
      name: "Fractal Design North XL",
      category: "CASE",
      brand: "Fractal Design",
      description: "Модон урд нүүртэй, premium airflow хийц бүхий бүтэн хэмжээний tower case.",
      priceCents: 21900,
      stock: 14,
      imageUrl: "https://images.unsplash.com/photo-1545239351-1141bd82e8a6?auto=format&fit=crop&w=900&q=80",
    },
    {
      sku: "MON-SAMSUNG-G6",
      slug: "samsung-odyssey-g6",
      name: "Samsung Odyssey G6",
      category: "MONITOR",
      brand: "Samsung",
      description: "240Hz refresh rate, QHD curved gaming monitor with vivid color and fast response.",
      priceCents: 45900,
      stock: 17,
      imageUrl: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=900&q=80",
    },
    {
      sku: "PC-APEX-4K",
      slug: "apex-4k-extreme-pc",
      name: "Apex 4K Extreme PC",
      category: "PC_BUILD",
      brand: "XADE Builds",
      description: "Ultra-tier graphics, liquid cooling, and premium parts for flagship gaming and creator work.",
      priceCents: 329900,
      stock: 9,
      imageUrl: "https://images.unsplash.com/photo-1598550476439-6847785fcea6?auto=format&fit=crop&w=900&q=80",
    },
    {
      sku: "MOUSE-GLORIOUS-O2",
      slug: "glorious-model-o-2-pro",
      name: "Glorious Model O 2 Pro",
      category: "MOUSE",
      brand: "Glorious",
      description: "Lightweight competitive wireless gaming mouse with smooth glide and low click latency.",
      priceCents: 14900,
      stock: 24,
      imageUrl: "https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?auto=format&fit=crop&w=900&q=80",
    },
    {
      sku: "KB-KEYCHRON-Q1MAX",
      slug: "keychron-q1-max",
      name: "Keychron Q1 Max",
      category: "KEYBOARD",
      brand: "Keychron",
      description: "Premium wireless aluminum mechanical keyboard for gaming and everyday work.",
      priceCents: 23900,
      stock: 21,
      imageUrl: "https://images.unsplash.com/photo-1511467687858-23d96c32e4ae?auto=format&fit=crop&w=900&q=80",
    },
    {
      sku: "PAD-STEELSERIES-QCK",
      slug: "steelseries-qck-heavy-xl",
      name: "SteelSeries QcK Heavy XL",
      category: "MOUSEPAD",
      brand: "SteelSeries",
      description: "Thick control surface mousepad suited for precise aim and long gaming sessions.",
      priceCents: 4900,
      stock: 30,
      imageUrl: "https://images.unsplash.com/photo-1587033411391-5d9e51cce126?auto=format&fit=crop&w=900&q=80",
    },
  ];

  for (const product of products) {
    const seededProduct = {
      ...product,
      isActive: true,
      stock: Math.max(product.stock, 120),
    };

    await prisma.product.upsert({
      where: {
        tenantId_sku: {
          tenantId: tenant.id,
          sku: product.sku,
        },
      },
      update: seededProduct,
      create: {
        tenantId: tenant.id,
        ...seededProduct,
      },
    });
  }

  await prisma.product.updateMany({
    where: {
      tenantId: tenant.id,
    },
    data: {
      isActive: true,
    },
  });

  await prisma.$executeRaw`
    UPDATE "Product"
    SET "stock" = GREATEST("stock", 120)
    WHERE "tenantId" = CAST(${tenant.id} AS uuid)
  `;

  const tenantCustomers = await prisma.user.findMany({
    where: {
      tenantId: tenant.id,
      role: UserRole.CUSTOMER,
    },
    select: {
      id: true,
      name: true,
      email: true,
      _count: {
        select: {
          orders: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  const defaultDemoProducts = await prisma.product.findMany({
    where: {
      tenantId: tenant.id,
      sku: {
        in: ["CPU-RYZEN7-7800X3D", "GPU-RTX-4070-SUPER", "MON-ASUS-VG27AQ3A"],
      },
    },
    orderBy: {
      priceCents: "asc",
    },
    take: 3,
  });

  for (const customer of tenantCustomers) {
    if (customer._count.orders > 0 || defaultDemoProducts.length === 0) {
      continue;
    }

    for (const [index, product] of defaultDemoProducts.entries()) {
      const dropoffAddress = `Demo customer address ${index + 1}, Ulaanbaatar`;
      const delivery = await prisma.delivery.create({
        data: {
          tenantId: tenant.id,
          createdById: customer.id,
          trackingCode: `TRK-DEMO-${customer.id.slice(0, 4).toUpperCase()}-${index + 1}`,
          pickupAddress: env.WAREHOUSE_ADDRESS,
          pickupLat: env.WAREHOUSE_LAT,
          pickupLng: env.WAREHOUSE_LNG,
          dropoffAddress,
          dropoffLat: 47.9184 + index * 0.0035,
          dropoffLng: 106.9177 + index * 0.0042,
          status: index === 0 ? "PENDING" : index === 1 ? "ASSIGNED" : "IN_TRANSIT",
          assignedAt: index >= 1 ? new Date() : null,
          acceptedAt: index >= 2 ? new Date() : null,
          pickedUpAt: index >= 2 ? new Date() : null,
          eta: new Date(Date.now() + (index + 1) * 30 * 60 * 1000),
          notes: `Demo order restored for ${customer.email}`,
        },
      });

      await prisma.order.create({
        data: {
          tenantId: tenant.id,
          customerId: customer.id,
          deliveryId: delivery.id,
          orderNumber: `ORD-DEMO-${customer.id.slice(0, 4).toUpperCase()}-${index + 1}`,
          status: "PROCESSING",
          totalAmountCents: product.priceCents,
          shippingAddress: dropoffAddress,
          shippingLat: 47.9184 + index * 0.0035,
          shippingLng: 106.9177 + index * 0.0042,
          notes: `Demo order restored for ${customer.name}`,
          items: {
            create: [
              {
                productId: product.id,
                quantity: 1,
                unitPriceCents: product.priceCents,
              },
            ],
          },
        },
      });

      await prisma.trackingEvent.createMany({
        data: [
          {
            tenantId: tenant.id,
            deliveryId: delivery.id,
            eventType: "CREATED",
            status: "PENDING",
            message: "Delivery created for restored demo order",
          },
          ...(index >= 1
            ? [
                {
                  tenantId: tenant.id,
                  deliveryId: delivery.id,
                  eventType: "ASSIGNED" as const,
                  status: "ASSIGNED" as const,
                  message: "Driver assigned to restored demo order",
                },
              ]
            : []),
          ...(index >= 2
            ? [
                {
                  tenantId: tenant.id,
                  deliveryId: delivery.id,
                  eventType: "STATUS_UPDATED" as const,
                  status: "IN_TRANSIT" as const,
                  message: "Courier is on the way for restored demo order",
                },
              ]
            : []),
        ],
      });
    }
  }

  const driver = await prisma.driver.upsert({
    where: { id: "22222222-2222-4222-8222-222222222222" },
    update: {
      tenantId: tenant.id,
      userId: driverUser.id,
      name: "Bat Driver",
      phone: "+976-99112233",
      status: "BUSY",
    },
    create: {
      id: "22222222-2222-4222-8222-222222222222",
      tenantId: tenant.id,
      userId: driverUser.id,
      name: "Bat Driver",
      phone: "+976-99112233",
      status: "BUSY",
    },
  });

  const delivery = await prisma.delivery.upsert({
    where: { trackingCode },
    update: {
      tenantId: tenant.id,
      driverId: driver.id,
      createdById: admin.id,
      pickupAddress: env.WAREHOUSE_ADDRESS,
      pickupLat: env.WAREHOUSE_LAT,
      pickupLng: env.WAREHOUSE_LNG,
      dropoffAddress: "National Amusement Park, Ulaanbaatar",
      dropoffLat: 47.9056,
      dropoffLng: 106.9308,
      status: "IN_TRANSIT",
      assignedAt: new Date(),
      acceptedAt: new Date(),
      pickedUpAt: new Date(),
      eta: new Date(Date.now() + 45 * 60 * 1000),
      notes: "Seeded demo delivery for public tracking",
    },
    create: {
      tenantId: tenant.id,
      trackingCode,
      driverId: driver.id,
      createdById: admin.id,
      pickupAddress: env.WAREHOUSE_ADDRESS,
      pickupLat: env.WAREHOUSE_LAT,
      pickupLng: env.WAREHOUSE_LNG,
      dropoffAddress: "National Amusement Park, Ulaanbaatar",
      dropoffLat: 47.9056,
      dropoffLng: 106.9308,
      status: "IN_TRANSIT",
      assignedAt: new Date(),
      acceptedAt: new Date(),
      pickedUpAt: new Date(),
      eta: new Date(Date.now() + 45 * 60 * 1000),
      notes: "Seeded demo delivery for public tracking",
    },
  });

  const driverMission = await prisma.delivery.upsert({
    where: { trackingCode: driverMissionTrackingCode },
    update: {
      tenantId: tenant.id,
      driverId: driver.id,
      createdById: admin.id,
      pickupAddress: env.WAREHOUSE_ADDRESS,
      pickupLat: env.WAREHOUSE_LAT,
      pickupLng: env.WAREHOUSE_LNG,
      dropoffAddress: "Shangri-La Centre, Ulaanbaatar",
      dropoffLat: 47.9139,
      dropoffLng: 106.9176,
      status: "ASSIGNED",
      assignedAt: new Date(),
      acceptedAt: null,
      pickedUpAt: null,
      deliveredAt: null,
      eta: new Date(Date.now() + 30 * 60 * 1000),
      notes: "Seeded demo mission for driver acceptance flow",
    },
    create: {
      tenantId: tenant.id,
      trackingCode: driverMissionTrackingCode,
      driverId: driver.id,
      createdById: admin.id,
      pickupAddress: env.WAREHOUSE_ADDRESS,
      pickupLat: env.WAREHOUSE_LAT,
      pickupLng: env.WAREHOUSE_LNG,
      dropoffAddress: "Shangri-La Centre, Ulaanbaatar",
      dropoffLat: 47.9139,
      dropoffLng: 106.9176,
      status: "ASSIGNED",
      assignedAt: new Date(),
      eta: new Date(Date.now() + 30 * 60 * 1000),
      notes: "Seeded demo mission for driver acceptance flow",
    },
  });

  await prisma.trackingEvent.deleteMany({
    where: {
      deliveryId: delivery.id,
    },
  });

  await prisma.trackingEvent.createMany({
    data: [
      {
        tenantId: tenant.id,
        deliveryId: delivery.id,
        eventType: "CREATED",
        status: "PENDING",
        message: "Delivery created",
      },
      {
        tenantId: tenant.id,
        deliveryId: delivery.id,
        eventType: "ASSIGNED",
        status: "ASSIGNED",
        message: "Driver assigned",
      },
      {
        tenantId: tenant.id,
        deliveryId: delivery.id,
        eventType: "STATUS_UPDATED",
        status: "ACCEPTED",
        message: "Driver accepted delivery",
      },
      {
        tenantId: tenant.id,
        deliveryId: delivery.id,
        eventType: "STATUS_UPDATED",
        status: "PICKED_UP",
        message: "Parcel picked up",
      },
      {
        tenantId: tenant.id,
        deliveryId: delivery.id,
        eventType: "STATUS_UPDATED",
        status: "IN_TRANSIT",
        message: "Courier is on the way",
      },
    ],
  });

  await prisma.trackingEvent.deleteMany({
    where: {
      deliveryId: driverMission.id,
    },
  });

  await prisma.trackingEvent.createMany({
    data: [
      {
        tenantId: tenant.id,
        deliveryId: driverMission.id,
        eventType: "CREATED",
        status: "PENDING",
        message: "Delivery created",
      },
      {
        tenantId: tenant.id,
        deliveryId: driverMission.id,
        eventType: "ASSIGNED",
        status: "ASSIGNED",
        message: "Driver assigned and waiting for acceptance",
      },
    ],
  });

  const existingLocation = await prisma.driverLocation.findFirst({
    where: {
      driverId: driver.id,
    },
  });

  if (!existingLocation) {
    await prisma.driverLocation.create({
      data: {
        tenantId: tenant.id,
        driverId: driver.id,
        latitude: 47.9128,
        longitude: 106.9254,
      },
    });
  }

  console.log("Seed complete");
  console.log(`Admin login: ${adminEmail} / password123`);
  console.log(`Driver login: ${driverEmail} / password123`);
  console.log(`Customer login: ${customerEmail} / password123`);
  console.log(`Public tracking code: ${trackingCode}`);
  console.log(`Driver mission tracking code: ${driverMissionTrackingCode}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
