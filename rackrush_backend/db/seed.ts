// db/seed.ts - Naplnenie databazy uvodnymi datami
require('dotenv').config();
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function seed() {
  const client = await pool.connect();
  try {
    console.log('Seeding database with supermarket data...');

    // Predplatne plany
    await client.query(`
      INSERT INTO subscription_detail (name, features, price, billing_period) VALUES
        ('Premium Mesačne', 'Zľavy, Doprava zadarmo, Prioritná podpora', 5.99, 'monthly'),
        ('Premium Ročne', 'Všetky výhody, 2 mesačne zadarmo, VIP eventy', 59.99, 'yearly')
      ON CONFLICT DO NOTHING;
    `);

    // Hlavne kategorie
    await client.query(`
      INSERT INTO categories (id, name, parent_id) VALUES
        (1,  'Ovocie a zelenina',    NULL),
        (2,  'Mliečne a chladené',   NULL),
        (3,  'Mäso a ryby',          NULL),
        (4,  'Pečivo',               NULL),
        (5,  'Trvanlivé potraviny',  NULL),
        (6,  'Nápoje',               NULL),
        (7,  'Sladké a slané',       NULL),
        (8,  'Mrazené produkty',     NULL),
        (9,  'Pre deti',             NULL),
        (10, 'Kozmetika a drogéria', NULL),
        (11, 'Domácnosť',            NULL),
        (12, 'Pre zvieratá',         NULL),
        (13, 'Jablká a hrušky',      1),
        (14, 'Exotické ovocie',      1),
        (15, 'Jogurty',              2),
        (16, 'Syr a vajcia',         2),
        (17, 'Čerstvé mäso',         3),
        (18, 'Ryby a morské plody',  3),
        (19, 'Slané snacky',         7),
        (20, 'Čokolády a sladkosti', 7)
      ON CONFLICT DO NOTHING;
    `);

    // Produkty
    // Pouzity ENUM unit_type: piece | gram | kg | liter | pack
    await client.query(`
      INSERT INTO products (category_id, name, weight, unit_type, description, price, adults_only, point_value) VALUES
        (13, 'Jablko Gala',            1,    'kg',   'Sladké a chrumkavé domáce jablká', 1.49, FALSE, 2),
        (14, 'Banány Premium',         1,    'kg',   'Prémiové banány z Ekvádoru', 1.79, FALSE, 2),
        (15, 'Grécky jogurt biely',    150,  'gram', 'Hustý krémový jogurt s vysokým obsahom proteínu', 0.89, FALSE, 1),
        (16, 'Eidam plátky 45%',       100,  'gram', 'Klasický tvrdý syr, balený', 1.29, FALSE, 2),
        (17, 'Kuracie prsia',          500,  'gram', 'Čerstvé kuracie krémne', 4.49, FALSE, 5),
        (18, 'Losos filet',            200,  'gram', 'Čerstvý filet z atlantického lososa', 6.99, FALSE, 10),
        (4,  'Rožok biely',            40,   'gram', 'Chrumkavé čerstvé pečivo', 0.13, FALSE, 1),
        (4,  'Chlieb kváskový',        500,  'gram', 'Pšenično-ražný chlieb podľa tradičnej receptúry', 1.99, FALSE, 3),
        (5,  'Cestoviny Penne',        500,  'gram', 'Semolinové cestoviny z tvrdej pšenice', 0.99, FALSE, 1),
        (5,  'Ryža Basmati',           1,    'kg',   'Dlhozrnná aromatická ryža', 2.49, FALSE, 3),
        (6,  'Minerálka sýtená',       1.5,  'liter','Prírodná minerálna voda', 0.59, FALSE, 1),
        (6,  'Pivo Pilsner Urquell',   0.5,  'liter','Svetlý ležiak, plechovka', 1.29, TRUE,  2),
        (19, 'Zemiakové lupienky',     100,  'gram', 'Solené chrumkavé chipsy', 1.49, FALSE, 2),
        (20, 'Horká čokoláda 70%',     100,  'gram', 'Vysokokvalitná belgická čokoláda', 1.99, FALSE, 3),
        (11, 'Prací gél Universal',    2,    'liter','Účinný prací gél na 40 praní', 9.99, FALSE, 15),
        (10, 'Sprchový gél Sensitive', 250,  'gram', 'Jemný gél s výťažkom z aloe vera', 2.49, FALSE, 4),
        (12, 'Granule pre psov',       2,    'kg',   'Kompletné krmivo pre dospelých psov', 5.49, FALSE, 8)
      ON CONFLICT DO NOTHING;
    `);

    // Predajne s POINT suradnicami
    await client.query(`
      INSERT INTO stores (name, address, phone_number, location, opening_hours, max_occupancy, live_occupancy) VALUES
        ('RackRush Market - Centrál', 'Metodova 6, 821 08 Bratislava', '+421 2 555 1111', POINT(17.1285, 48.1565), 'Po-So 07:00-21:00, Ne 08:00-20:00', 200, 50),
        ('RackRush Market - Aupark',  'Einsteinova 18, 851 01 Bratislava', '+421 2 555 2222', POINT(17.1086, 48.1321), 'Po-Ne 08:00-21:00', 300, 80),
        ('RackRush Express - Hlavná', 'Hlavná ulica 1, 040 01 Košice', '+421 55 555 3333', POINT(21.2575, 48.7212), 'Po-Pi 06:00-22:00, So-Ne 07:00-21:00', 100, 25)
      ON CONFLICT DO NOTHING;
    `);

    // Katalog odmien
    await client.query(`
      INSERT INTO reward_catalog (title, description, reward_type, point_cost, adults_only) VALUES
        ('Zľava 5€ na nákup',        'Špeciálna zľava', 1, 500, FALSE),
        ('Zľava 10€ na nákup',       'Super zľava',     1, 900,  FALSE),
        ('Čokoláda zadarmo',         'Malý darček',     2, 150,  FALSE),
        ('Plátenná taška RackRush',  'Eko taška',       3, 100,  FALSE),
        ('2x body za celý nákup',    'Dvojnásobný zisk',4, 0,    FALSE)
      ON CONFLICT DO NOTHING;
    `);

    // Admin ucet
    const hash = await bcrypt.hash('Admin1234!', 10);
    await client.query(`
      INSERT INTO users (full_name, email, password_hash, role)
      VALUES ('Správca Marketu', 'admin@rackrush.sk', $1, 'admin')
      ON CONFLICT (email) DO NOTHING;
    `, [hash]);

    // Naviazane zaznamy pre admina
    const res = await client.query(`SELECT id FROM users WHERE email = 'admin@rackrush.sk'`);
    const adminId = res.rows[0]?.id;
    if (adminId) {
      await client.query(`INSERT INTO loyalty_cards (user_id, qr_code_data, current_points) VALUES ($1, $2, 0) ON CONFLICT DO NOTHING`, [adminId, 'RACKRUSH-ADMIN']);
      await client.query(`INSERT INTO user_account (user_id)               VALUES ($1) ON CONFLICT DO NOTHING`, [adminId]);
      await client.query(`INSERT INTO user_preferences (user_id)           VALUES ($1) ON CONFLICT DO NOTHING`, [adminId]);
      await client.query(`INSERT INTO user_notifications (user_id)         VALUES ($1) ON CONFLICT DO NOTHING`, [adminId]);
    }

    console.log('Seed completed with supermarket data!');
    console.log('   Admin login → email: admin@rackrush.sk  |  password: Admin1234!');
  } catch (err: any) {
    console.error('Seed error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
