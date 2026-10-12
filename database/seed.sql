-- ============================================================================
-- Retail Inventory and Sales Management System
-- File: seed.sql
-- Description: Realistic Indian Retail Dataset:
--              8 Categories, 10 Suppliers, 60 Products, 40 Customers,
--              300 Historical Sales Orders with Line Items & Payments
-- ============================================================================

-- Clean slate
TRUNCATE TABLE audit_log, stock_alert, payment, sales_detail, sales, customer, inventory, product, category, supplier RESTART IDENTITY CASCADE;

-- ============================================================================
-- 1. SEED CATEGORIES (8 Categories)
-- ============================================================================
INSERT INTO category (category_name, description) VALUES
('Grocery & Staples', 'Daily essential grains, flours, edible oils, pulses, and pantry essentials.'),
('Dairy & Breakfast', 'Fresh milk, butter, cheese, yogurt, cereals, oats, and morning nutrition.'),
('Snacks & Confectionery', 'Traditional namkeens, chips, biscuits, cookies, chocolates, and sweets.'),
('Beverages & Drinks', 'Tea, premium coffee, fruit juices, cold beverages, and herbal cordials.'),
('Personal Care & Hygiene', 'Soaps, body washes, hair oils, shampoos, toothpastes, and skincare.'),
('Home Care & Cleaning', 'Laundry detergents, dishwash gels, floor disinfectants, and toilet cleaners.'),
('Spices & Condiments', 'Pure and blended ground spices, culinary pastes, ketchups, and sauces.'),
('Packaged & Instant Foods', 'Instant noodles, ready-to-eat meals, instant soups, and vermicelli.');

-- ============================================================================
-- 2. SEED SUPPLIERS (10 Leading Indian FMCG Manufacturers)
-- ============================================================================
INSERT INTO supplier (supplier_name, phone, email, address) VALUES
('ITC Limited', '+91 33 2288 9371', 'procurement@itc.in', 'Virginia House, 37 J.L. Nehru Road, Kolkata, West Bengal - 700071'),
('Tata Consumer Products', '+91 22 6665 8282', 'fmcg.orders@tataconsumer.com', '11/13 Botawala Building, Horniman Circle, Fort, Mumbai, Maharashtra - 400001'),
('Hindustan Unilever Limited', '+91 22 5043 0000', 'distributors@hul.co.in', 'Unilever House, B.D. Sawant Marg, Chakala, Andheri East, Mumbai, Maharashtra - 400099'),
('Nestle India Limited', '+91 124 238 9300', 'institutional.sales@in.nestle.com', 'Nestle House, Jacaranda Marg, ' || 'M Block, DLF Phase 2, Gurugram, Haryana - 122002'),
('Britannia Industries', '+91 80 3768 7100', 'orders@britannia.co.in', 'Prestige Shantiniketan, Whitefield Main Road, Bengaluru, Karnataka - 560048'),
('Gujarat Co-operative Milk (Amul)', '+91 2692 258506', 'supplychain@amul.coop', 'Amul Dairy Road, Anand, Gujarat - 388001'),
('Parle Products Pvt Ltd', '+91 22 6691 6911', 'b2b@parle.biz', 'North Level Crossing, Vile Parle East, Mumbai, Maharashtra - 400057'),
('Dabur India Limited', '+91 120 398 2000', 'institutional@dabur.com', '8/3 Asaf Ali Road, New Delhi / Kaushambi, Ghaziabad, UP - 201010'),
('Marico Limited', '+91 22 6648 0480', 'consumer.supplies@marico.com', 'Grande Palladium, 175 CST Road, Kalina, Santacruz East, Mumbai, Maharashtra - 400098'),
('Godrej Consumer Products', '+91 22 2518 8010', 'trade.desk@godrejcp.com', 'Godrej One, Pirojshanagar, Eastern Express Highway, Vikhroli, Mumbai, Maharashtra - 400079');

-- ============================================================================
-- 3. SEED PRODUCTS (60 Master Products across 8 Categories and 10 Suppliers)
-- ============================================================================
INSERT INTO product (product_name, category_id, supplier_id, unit_price, reorder_level) VALUES
-- Category 1: Grocery & Staples (IDs 1-8)
('Aashirvaad Superior MP Shudh Chakki Atta 5kg', 1, 1, 245.00, 15),
('Fortune Sunlite Refined Sunflower Oil 1L', 1, 2, 145.00, 20),
('Tata Salt Vacuum Evaporated Iodised 1kg', 1, 2, 28.00, 30),
('Daawat Rozana Super Basmati Rice 5kg', 1, 1, 395.00, 12),
('Tata Sampann Unpolished Toor Dal 1kg', 1, 2, 185.00, 15),
('Rajdhani Pure Chana Dal Besan 1kg', 1, 1, 115.00, 15),
('Madhur Pure & Hygienic Refined Sugar 1kg', 1, 1, 55.00, 25),
('Fortune Kachi Ghani Pure Mustard Oil 1L', 1, 2, 165.00, 20),

-- Category 2: Dairy & Breakfast (IDs 9-16)
('Amul Butter Pasteurized Table Butter 500g', 2, 6, 275.00, 25),
('Amul Taaza Homogenised Toned Milk 1L', 2, 6, 74.00, 30),
('Amul Masti Dahi Fresh Curd 400g', 2, 6, 40.00, 20),
('Amul Malai Fresh Paneer 200g', 2, 6, 95.00, 15),
('Britannia Pure Cheese Slices 200g (10 Slices)', 2, 5, 145.00, 15),
('Mother Dairy Daily Classic Cow Milk 1L', 2, 6, 58.00, 20),
('Kelloggs Corn Flakes Original 475g', 2, 4, 225.00, 10),
('Quaker Whole Grain Rolled Oats 1kg', 2, 5, 195.00, 12),

-- Category 3: Snacks & Confectionery (IDs 17-24)
('Parle-G Original Glucose Biscuits 800g Super Saver', 3, 7, 85.00, 30),
('Britannia Good Day Cashew Cookies 600g Value Pack', 3, 5, 130.00, 25),
('Haldirams Nagpur Aloo Bhujia 400g', 3, 7, 115.00, 20),
('Haldirams Khatta Meetha Mixture 400g', 3, 7, 110.00, 20),
('Lays Indias Magic Masala Potato Chips 115g', 3, 5, 50.00, 30),
('Kurkure Masala Munch Crispy Snacks 115g', 3, 5, 50.00, 30),
('Cadbury Dairy Milk Silk Chocolate Bar 150g', 3, 4, 175.00, 15),
('Sunfeast Dark Fantasy Choco Fills Biscuits 300g', 3, 1, 140.00, 18),

-- Category 4: Beverages & Drinks (IDs 25-32)
('Bru Instant Coffee Roasted Chicory Blend 200g', 4, 3, 380.00, 12),
('Nescafe Classic 100% Pure Instant Coffee Jar 100g', 4, 4, 340.00, 12),
('Tata Tea Gold Leaf & Gentle Pressed Leaves 500g', 4, 2, 310.00, 18),
('Brooke Bond Red Label Natural Care Tea 500g', 4, 3, 295.00, 18),
('Real Fruit Power Mixed Fruit Juice 1L Tetra', 4, 8, 130.00, 15),
('Tropicana 100% Real Squeezed Orange Juice 1L', 4, 8, 145.00, 15),
('Frooti Fresh Mango Juicy Drink 1.2L Bottle', 4, 7, 75.00, 20),
('Hamdard Rooh Afza Herbal Rose Sharbat 750ml', 4, 8, 180.00, 10),

-- Category 5: Personal Care & Hygiene (IDs 33-40)
('Dettol Original Liquid Handwash Refill Pouch 1500ml', 5, 8, 239.00, 15),
('Lifebuoy Total 10 Germ Protection Soap 125g Pack of 4', 5, 3, 160.00, 25),
('Dove Deeply Nourishing Body Wash Pump 800ml', 5, 3, 499.00, 10),
('Head & Shoulders Cool Menthol Anti-Dandruff Shampoo 650ml', 5, 3, 580.00, 10),
('Colgate Total Whole Mouth Health Toothpaste 150g', 5, 3, 140.00, 25),
('Sensodyne Fresh Gel Sensitive Teeth Toothpaste 150g', 5, 3, 210.00, 15),
('Parachute 100% Pure Coconut Hair Oil 500ml Bottle', 5, 9, 215.00, 20),
('Nivea Soft Light All-Season Moisturizing Cream 200ml', 5, 9, 290.00, 12),

-- Category 6: Home Care & Cleaning (IDs 41-48)
('Surf Excel Quick Wash Detergent Powder 2kg Polybag', 6, 3, 395.00, 20),
('Ariel Matic Top Load Washing Machine Detergent 2kg', 6, 3, 460.00, 15),
('Vim Dishwash Gel Lemon Deep Cleansing 750ml Bottle', 6, 3, 165.00, 25),
('Harpic Power Plus Disinfectant Toilet Cleaner 1L', 6, 8, 215.00, 20),
('Lizol Disinfectant Surface & Floor Cleaner Citrus 2L', 6, 8, 380.00, 15),
('Good Knight Gold Flash Liquid Vaporizer Mosquito Refill Twin', 6, 10, 155.00, 25),
('Comfort Morning Fresh Fabric Conditioner 860ml', 6, 3, 235.00, 15),
('Colin Glass and Multi-Surface Cleaner Spray 500ml', 6, 8, 105.00, 20),

-- Category 7: Spices & Condiments (IDs 49-56)
('Catch Super Garam Masala Ground Powder 100g Box', 7, 8, 88.00, 15),
('Everest Pure & Aromatic Turmeric Powder 200g', 7, 8, 64.00, 20),
('Everest Kashmirilal Bright Red Chilli Powder 100g', 7, 8, 92.00, 20),
('Tata Sampann Pure Dhania Coriander Powder 200g', 7, 2, 70.00, 20),
('MDH Chunky Chat Masala Seasoning 100g', 7, 8, 78.00, 15),
('Kissan Fresh 100% Real Tomato Ketchup 950g Bottle', 7, 3, 135.00, 20),
('Chings Secret Dark Soy Sauce 210g Glass Bottle', 7, 1, 60.00, 15),
('Dabur Hommade Pure Ginger Garlic Paste 200g Pouch', 7, 8, 55.00, 20),

-- Category 8: Packaged & Instant Foods (IDs 57-60)
('Maggi 2-Minute Masala Instant Noodles 12-Pack 840g', 8, 4, 168.00, 30),
('Sunfeast Yippee Magic Masala Noodles 8-Pack 560g', 8, 1, 112.00, 25),
('Knorr Classic Mixed Vegetable Soup 4-Pack 172g', 8, 3, 150.00, 20),
('MTR Ready to Eat Paneer Butter Masala Curry 300g Retort', 8, 8, 125.00, 15);

-- ============================================================================
-- 4. SEED INITIAL INVENTORY (60 Products with ample starting balances)
-- ============================================================================
INSERT INTO inventory (product_id, quantity_in_hand, last_updated)
SELECT
    product_id,
    -- Generous initial buffer between 200 and 350 so 300 sales proceed without overselling
    (220 + (product_id * 3) % 80) AS quantity_in_hand,
    CURRENT_TIMESTAMP - INTERVAL '180 days'
FROM product;

-- ============================================================================
-- 5. SEED CUSTOMERS (40 Diverse Indian Retail Shoppers)
-- ============================================================================
INSERT INTO customer (customer_name, phone, email, address) VALUES
('Aarav Sharma', '+91 98201 11221', 'aarav.sharma@gmail.com', 'Flat 402, Sea Breeze Apts, Bandra West, Mumbai, Maharashtra'),
('Priya Patel', '+91 98250 22332', 'priya.patel92@yahoo.com', 'B-14, Shivalik Residency, Satellite, Ahmedabad, Gujarat'),
('Rajesh Iyer', '+91 98401 33443', 'iyer.rajesh@rediffmail.com', '12/4, 2nd Main Road, R.A. Puram, Chennai, Tamil Nadu'),
('Ananya Gupta', '+91 98111 44554', 'ananya.gupta@outlook.com', 'C-48, Sector 14, Noida, Gautam Buddha Nagar, UP'),
('Vikram Singh', '+91 98290 55665', 'vikram.rathore@gmail.com', '78, Civil Lines, Near High Court, Jaipur, Rajasthan'),
('Meera Nair', '+91 98470 66776', 'meera.nair88@gmail.com', 'Plot 21, Panampilly Nagar, Kochi, Kerala'),
('Rohan Mehta', '+91 98202 77887', 'rohan.mehta@techcorp.in', '304, Palm Grove, Hiranandani Estate, Thane West, Maharashtra'),
('Sneha Mukherjee', '+91 98300 88998', 'sneha.m@calcutta.edu', '56A, Southern Avenue, Lake Market, Kolkata, West Bengal'),
('Deepak Verma', '+91 98100 99009', 'verma.deepak77@gmail.com', 'B-2/104, Safdarjung Enclave, New Delhi - 110029'),
('Pooja Reddy', '+91 98490 12345', 'pooja.reddy@hyderabad.org', 'Flat 801, My Home Bhooja, HITEC City, Hyderabad, Telangana'),
('Aditya Joshi', '+91 98220 23456', 'aditya.joshi@pune.co.in', '15, Mayur Colony, Kothrud, Pune, Maharashtra'),
('Kavita Rao', '+91 98800 34567', 'kavita.rao@blrtech.com', '42, 4th Cross, Indiranagar 1st Stage, Bengaluru, Karnataka'),
('Suresh Menon', '+91 98450 45678', 'suresh.menon@gmail.com', 'A-302, Palm Meadows, Whitefield, Bengaluru, Karnataka'),
('Sunita Deshmukh', '+91 98230 56789', 'sunita.deshmukh@nagpur.in', 'Plot 9, Shankar Nagar, Nagpur, Maharashtra'),
('Amitabh Das', '+91 98310 67890', 'amitabh.das@kolkata.co.in', '88, Salt Lake Sector 2, Bidhannagar, Kolkata, West Bengal'),
('Neha Kulkarni', '+91 98221 78901', 'neha.kulkarni@gmail.com', '7, Prabhat Road, Lane 4, Deccan Gymkhana, Pune, Maharashtra'),
('Karthik Subbaram', '+91 98410 89012', 'karthik.s@chennai.net', '33, Gandhi Road, T. Nagar, Chennai, Tamil Nadu'),
('Divya Nambiar', '+91 98460 90123', 'divya.n@kerala.ac.in', 'TC 14/850, Nandavanam, Thiruvananthapuram, Kerala'),
('Gaurav Bhatia', '+91 98112 01234', 'bhatia.gaurav@yahoo.com', 'E-21, Greater Kailash Part 1, New Delhi - 110048'),
('Tanvi Hegde', '+91 98860 12341', 'tanvi.hegde@infosys.com', '24, Malleshwaram 8th Cross, Bengaluru, Karnataka'),
('Manish Chawla', '+91 98140 23452', 'm.chawla@chandigarh.org', 'House 524, Sector 8-B, Chandigarh - 160018'),
('Swati Agarwal', '+91 98260 34563', 'swati.agarwal@indore.in', '102, Saket Nagar, Indore, Madhya Pradesh'),
('Rahul Bose', '+91 98301 45674', 'rahul.bose85@gmail.com', '14/1, Ballygunge Circular Road, Kolkata, West Bengal'),
('Shalini Tiwari', '+91 98390 56785', 'shalini.tiwari@lucknow.net', 'Flat 101, Rohtas Court, Gomti Nagar, Lucknow, UP'),
('Harish Pillai', '+91 98480 67896', 'pillai.harish@gmail.com', 'Plot 120, Road No. 36, Jubilee Hills, Hyderabad, Telangana'),
('Shruti Saxena', '+91 98180 78907', 'shruti.saxena@delhi.gov.in', 'A-89, Preet Vihar, Vikas Marg, East Delhi - 110092'),
('Nitin Gadre', '+91 98210 89018', 'nitin.gadre@mumbaicorporate.com', '12, Hindu Colony, Dadar East, Mumbai, Maharashtra'),
('Aparna Sen', '+91 98302 90129', 'aparna.sen@kolkata.org', 'Flat 5B, South City Towers, Prince Anwar Shah Road, Kolkata'),
('Vivek Choudhary', '+91 98291 01230', 'vivek.choudhary@jodhpur.in', '22, Ratanada, Circuit House Road, Jodhpur, Rajasthan'),
('Ritu Singhania', '+91 98113 12341', 'ritu.singhania@delhicapital.com', 'D-55, Defense Colony, New Delhi - 110024'),
('Ashwin Sundaram', '+91 98402 23452', 'ashwin.sundaram@tcs.com', 'Block 4, Ceebros Boulevard, OMR, Thoraipakkam, Chennai'),
('Geeta Marathe', '+91 98222 34563', 'geeta.marathe@nashik.net', '78, Gangapur Road, Anandwalli, Nashik, Maharashtra'),
('Siddharth Mishra', '+91 98610 45674', 'sid.mishra@bhubaneswar.in', 'Plot N-3/412, IRC Village, Nayapalli, Bhubaneswar, Odisha'),
('Madhuri Dixit-Patil', '+91 98231 56785', 'madhuri.p@aurangabad.org', '14, Samarth Nagar, Chhatrapati Sambhajinagar, Maharashtra'),
('Pankaj Tripathi', '+91 94500 67896', 'pankaj.tripathi@patna.biz', 'Flat 203, Maurya Vihar, Bailey Road, Patna, Bihar'),
('Bhavna Shah', '+91 98251 78907', 'bhavna.shah@surattextile.in', '701, Green City Tower, Pal Gam, Surat, Gujarat'),
('Arjun Kapoor', '+91 98101 89018', 'arjun.kapoor@gurgaonhub.com', 'Tower 3, The Magnolias, Golf Course Road, Gurugram, Haryana'),
('Rupa Banerjee', '+91 98303 90129', 'rupa.banerjee@heritage.org', '3, Alipore Park Road, Kolkata, West Bengal - 700027'),
('Mahesh Kamat', '+91 98223 01230', 'mahesh.kamat@panaji.goa', 'House 45, Altinho, Panaji, Goa - 403001'),
('Preeti Soni', '+91 98292 12341', 'preeti.soni@udaipur.co.in', '28, Saheli Marg, Near Saheliyon Ki Bari, Udaipur, Rajasthan');


-- ============================================================================
-- 6. SEED 300 REALISTIC SALES TRANSACTIONS (Spanning past 180 days)
-- Uses deterministic pseudo-random logic with PL/pgSQL
-- Line items trigger inventory decrements, subtotal computations & total synchronization
-- ============================================================================
DO $$
DECLARE
    v_sale_idx     INT;
    v_sales_id     INT;
    v_customer_id  INT;
    v_days_ago     NUMERIC;
    v_sale_ts      TIMESTAMPTZ;
    v_num_items    INT;
    v_item_slot    INT;
    v_prod_id      INT;
    v_qty          INT;
    v_unit_p       NUMERIC(10, 2);
    v_disc         NUMERIC(10, 2);
    v_mode_idx     INT;
    v_mode         VARCHAR(20);
    v_ref_no       VARCHAR(100);
    v_final_amount NUMERIC(12, 2);
    v_modes        VARCHAR(20)[] := ARRAY['Cash', 'Card', 'UPI', 'NetBanking'];
BEGIN
    -- Fix pseudo-random sequence for reproducible seed data
    PERFORM setseed(0.42857);

    FOR v_sale_idx IN 1..300
    LOOP
        -- Customer ID between 1 and 40 (skewed so top customers make more purchases)
        IF (v_sale_idx % 4 = 0) THEN
            v_customer_id := 1 + (v_sale_idx % 8); -- Top frequent customers (1 to 8)
        ELSIF (v_sale_idx % 3 = 0) THEN
            v_customer_id := 9 + (v_sale_idx % 12); -- Moderate frequent customers (9 to 20)
        ELSE
            v_customer_id := 1 + FLOOR(random() * 40)::INT;
        END IF;

        -- Evenly distribute timestamps across the last 180 days with time variations
        v_days_ago := 180.0 - ((v_sale_idx::NUMERIC / 300.0) * 179.0) + (random() * 0.8 - 0.4);
        IF v_days_ago < 0 THEN v_days_ago := 0.05; END IF;
        v_sale_ts  := CURRENT_TIMESTAMP - (v_days_ago * INTERVAL '1 day') - ((random() * 12) * INTERVAL '1 hour');

        -- Create sales header
        INSERT INTO sales (customer_id, sales_date, total_amount)
        VALUES (v_customer_id, v_sale_ts, 0.00)
        RETURNING sales_id INTO v_sales_id;

        -- Number of line items in this order (1 to 4 items)
        v_num_items := 1 + FLOOR(random() * 4)::INT;

        FOR v_item_slot IN 1..v_num_items
        LOOP
            -- Pick product ID (1 to 60) avoiding repeat in same order
            v_prod_id := 1 + (((v_sale_idx * 7) + (v_item_slot * 13)) % 60);

            -- Check if this product was already added to this sale; if so shift
            WHILE EXISTS (SELECT 1 FROM sales_detail WHERE sales_id = v_sales_id AND product_id = v_prod_id)
            LOOP
                v_prod_id := (v_prod_id % 60) + 1;
            END LOOP;

            SELECT unit_price INTO v_unit_p FROM product WHERE product_id = v_prod_id;

            -- Order quantity: 1 to 3 units
            v_qty := 1 + FLOOR(random() * 3)::INT;

            -- Occasional promotional discount (₹0, ₹10, ₹20, etc.)
            IF random() < 0.25 THEN
                v_disc := LEAST(ROUND((v_qty * v_unit_p * 0.10)::NUMERIC, 2), 50.00);
            ELSE
                v_disc := 0.00;
            END IF;

            -- Insert sales_detail: trigger calculates sub_total, decrements inventory, and updates sales.total_amount
            INSERT INTO sales_detail (sales_id, product_id, quantity, unit_price, discount, sub_total)
            VALUES (v_sales_id, v_prod_id, v_qty, v_unit_p, v_disc, 0.00);
        END LOOP;

        -- Read calculated order total
        SELECT total_amount INTO v_final_amount FROM sales WHERE sales_id = v_sales_id;

        -- Choose payment mode
        v_mode_idx := 1 + FLOOR(random() * 4)::INT;
        v_mode     := v_modes[v_mode_idx];

        -- Generate reference number
        IF v_mode = 'Cash' THEN
            v_ref_no := 'CASH-REC-' || TO_CHAR(v_sale_ts, 'YYYYMMDD') || '-' || LPAD(v_sale_idx::TEXT, 4, '0');
        ELSIF v_mode = 'UPI' THEN
            v_ref_no := 'UPI/' || TO_CHAR(v_sale_ts, 'YYMMDD') || '/' || LPAD((100000 + v_sale_idx * 17)::TEXT, 8, '0');
        ELSIF v_mode = 'Card' THEN
            v_ref_no := 'POS-AUTH-' || LPAD((800000 + v_sale_idx * 31)::TEXT, 6, '0');
        ELSE
            v_ref_no := 'NEFT-SBIN-' || TO_CHAR(v_sale_ts, 'YYYY') || LPAD(v_sale_idx::TEXT, 6, '0');
        END IF;

        -- Insert payment record matching sale timestamp
        INSERT INTO payment (sales_id, payment_date, amount, payment_mode, reference_no)
        VALUES (v_sales_id, v_sale_ts, v_final_amount, v_mode, v_ref_no);

    END LOOP;
END;
$$;


-- ============================================================================
-- 7. PURPOSEFULLY CONFIGURE LOW-STOCK ITEMS
-- Adjust 5 targeted products to be below reorder thresholds so that:
--   - v_low_stock view displays realistic shortages and priority rankings
--   - stock_alert table is properly populated with active warnings
-- ============================================================================

-- Product 3: Tata Salt (Reorder Level: 30) -> Set to 5 units (Critical)
UPDATE inventory SET quantity_in_hand = 5, last_updated = CURRENT_TIMESTAMP WHERE product_id = 3;

-- Product 9: Amul Butter (Reorder Level: 25) -> Set to 4 units (Critical)
UPDATE inventory SET quantity_in_hand = 4, last_updated = CURRENT_TIMESTAMP WHERE product_id = 9;

-- Product 26: Nescafe Classic 100g (Reorder Level: 12) -> Set to 3 units (Critical)
UPDATE inventory SET quantity_in_hand = 3, last_updated = CURRENT_TIMESTAMP WHERE product_id = 26;

-- Product 35: Dove Body Wash 800ml (Reorder Level: 10) -> Set to 2 units (Critical)
UPDATE inventory SET quantity_in_hand = 2, last_updated = CURRENT_TIMESTAMP WHERE product_id = 35;

-- Product 57: Maggi Noodles 12-Pack (Reorder Level: 30) -> Set to 8 units (Low Stock)
UPDATE inventory SET quantity_in_hand = 8, last_updated = CURRENT_TIMESTAMP WHERE product_id = 57;

-- Product 46: Good Knight Refill Twin (Reorder Level: 25) -> Set to 7 units (Low Stock)
UPDATE inventory SET quantity_in_hand = 7, last_updated = CURRENT_TIMESTAMP WHERE product_id = 46;
