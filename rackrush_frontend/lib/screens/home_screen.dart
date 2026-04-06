import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/api_service.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0B132B),
      body: CustomScrollView(
        slivers: [
          // Modern App Bar with Logo and Coins
          SliverAppBar(
            expandedHeight: 100.0, // Slightly smaller height
            floating: false,
            pinned: true,
            backgroundColor: const Color(0xFF0B132B).withOpacity(0.95),
            elevation: 0,
            flexibleSpace: FlexibleSpaceBar(
              titlePadding: const EdgeInsets.only(left: 20, bottom: 16),
              title: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  // Logo instead of text
                  Image.asset(
                    'assets/images/logo.png',
                    height: 45, // Prominent logo
                    fit: BoxFit.contain,
                  ),
                  Padding(
                    padding: const EdgeInsets.only(right: 20),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Text(
                          '50',
                          style: TextStyle(color: Color(0xFF6FFFE9), fontSize: 18, fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(width: 8),
                        Image.asset(
                          'assets/images/coin.png',
                          height: 28,
                          width: 28,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              background: Container(
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [Color(0xFF1C2541), Color(0xFF0B132B)],
                  ),
                ),
              ),
            ),
            leading: const SizedBox.shrink(), // Remove original leading logo
          ),

          // Main Content
          SliverToBoxAdapter(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 20),
                // Quick Access Cards
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20.0),
                  child: Row(
                    children: [
                      Expanded(
                        child: _buildQuickActionCard(
                          'VERNOSTNÁ KARTA',
                          'assets/images/qr-code.png',
                          const Color(0xFF5BC0BE),
                        ),
                      ),
                      const SizedBox(width: 15),
                      Expanded(
                        child: _buildQuickActionCard(
                          'NÁKUPNÝ ZOZNAM',
                          'assets/images/task_complete.png',
                          const Color(0xFF6FFFE9),
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 30),
                // Promo Banner
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20.0),
                  child: Container(
                    height: 180,
                    width: double.infinity,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(25),
                      gradient: const LinearGradient(
                        colors: [Color(0xFF3A506B), Color(0xFF1C2541)],
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF6FFFE9).withOpacity(0.05),
                          blurRadius: 20,
                          offset: const Offset(0, 10),
                        ),
                      ],
                    ),
                    child: Stack(
                      children: [
                        Positioned(
                          right: -20,
                          bottom: -20,
                          child: Icon(Icons.bolt_rounded, size: 150, color: Colors.white.withOpacity(0.05)),
                        ),
                        Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(
                                'LIMITOVANÁ PONUKA',
                                style: TextStyle(color: const Color(0xFF6FFFE9).withOpacity(0.7), letterSpacing: 2, fontSize: 12),
                              ),
                              const SizedBox(height: 10),
                              const Text(
                                'EXTRA BODY ZA NÁKUP',
                                style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w900),
                              ),
                              const SizedBox(height: 15),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                                decoration: BoxDecoration(
                                  color: const Color(0xFF6FFFE9),
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                child: const Text(
                                  'ZISTIŤ VIAC',
                                  style: TextStyle(color: Color(0xFF0B132B), fontWeight: FontWeight.bold, fontSize: 12),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

                const SizedBox(height: 35),
                _buildSectionHeader('AKTUÁLNE V ZĽAVE'),
                const SizedBox(height: 15),
                SizedBox(
                  height: 540, // Slightly more for safety
                  child: GridView.builder(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      mainAxisSpacing: 20,
                      crossAxisSpacing: 20,
                      childAspectRatio: 1.1, // Adjusted for more content
                    ),
                    itemCount: 10,
                    itemBuilder: (context, index) {
                      return _buildProductCard(
                        'Hrozno biele',
                        '0.68€', // Always on sale in this section
                        '0.55€',
                        '1kg = 0.55€',
                        '500g', // Added weight
                        index % 2 == 0,
                        'assets/images/grapes_white_tray.png',
                      );
                    },
                  ),
                ),

                const SizedBox(height: 35),
                _buildSectionHeader('PRE NAŠICH ČLENOV'),
                const SizedBox(height: 15),
                SizedBox(
                  height: 260,
                  child: ListView.builder(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    itemCount: 10,
                    itemBuilder: (context, index) {
                      final isOnSale = index % 2 == 0; // Mixed sales
                      return Container(
                        width: 200,
                        margin: const EdgeInsets.only(right: 20),
                        child: _buildProductCard(
                          'Prémiový produkt',
                          isOnSale ? '2.40€' : null,
                          '1.99€',
                          '1ks = 1.99€',
                          '250g', // Added weight
                          index % 3 == 0,
                          'assets/images/grapes_white_tray.png',
                        ),
                      );
                    },
                  ),
                ),

                const SizedBox(height: 60),
                Center(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 40.0),
                    child: RichText(
                      textAlign: TextAlign.center,
                      text: TextSpan(
                        style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                        children: [
                          const TextSpan(text: 'Ak sa chcete stať členom, stlačte '),
                          WidgetSpan(
                            child: GestureDetector(
                              onTap: () {},
                              child: const Text(
                                'TU',
                                style: TextStyle(color: Color(0xFF6FFFE9), fontWeight: FontWeight.bold, fontSize: 16),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 120),
              ],
            ),
          ),
        ],
      ),
      extendBody: true,
      bottomNavigationBar: _buildBottomNav(),
    );
  }

  Widget _buildSectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            title,
            style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w900, letterSpacing: 1),
          ),
          TextButton(
            onPressed: () {},
            child: const Text(
              'ZOBRAZIŤ VŠETKO',
              style: TextStyle(color: Color(0xFF5BC0BE), fontSize: 12, fontWeight: FontWeight.bold),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildQuickActionCard(String title, String assetPath, Color tintColor) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
      decoration: BoxDecoration(
        color: const Color(0xFF1C2541),
        borderRadius: BorderRadius.circular(15),
        border: Border.all(color: tintColor.withOpacity(0.2)),
      ),
      child: Row(
        children: [
          Image.asset(
            assetPath, 
            height: 24, 
            width: 24,
            color: const Color(0xFF6FFFE9), // Use Neon Ice instead of black
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              title,
              style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold, letterSpacing: 0.5),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildProductCard(String name, String? oldPrice, String currentPrice, String unitPrice, String weight, bool isFav, String productAsset) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF1C2541),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFF3A506B).withOpacity(0.5)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.2),
            blurRadius: 10,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Stack(
              children: [
                Center(
                  child: Padding(
                    padding: const EdgeInsets.all(12.0),
                    child: ClipRRect( // Round product image corners
                      borderRadius: BorderRadius.circular(15),
                      child: Image.asset(
                        productAsset, 
                        fit: BoxFit.contain,
                      ),
                    ),
                  ),
                ),
                Positioned(
                  top: 12,
                  right: 12,
                  child: Icon(
                    isFav ? Icons.favorite_rounded : Icons.favorite_border_rounded,
                    color: isFav ? const Color(0xFF6FFFE9) : const Color(0xFF3A506B),
                    size: 22,
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
                ),
                Text(
                  weight,
                  style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 12),
                ),
                const SizedBox(height: 6),
                if (oldPrice != null)
                  Text(
                    oldPrice,
                    style: const TextStyle(
                      color: Color(0xFF5BC0BE), // Brighter teal for better visibility
                      decoration: TextDecoration.lineThrough, 
                      decorationColor: Colors.redAccent, // Red line for even more visibility
                      decorationThickness: 2.5, // Thicker line for visibility
                      fontSize: 12,
                    ),
                  )
                else
                  const SizedBox(height: 18), // Placeholder for alignment
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      currentPrice,
                      style: const TextStyle(color: Color(0xFF6FFFE9), fontSize: 22, fontWeight: FontWeight.w900),
                    ),
                    GestureDetector(
                      onTap: () {},
                      child: Container(
                        padding: const EdgeInsets.all(4),
                        decoration: BoxDecoration(
                          color: const Color(0xFF0B132B),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: const Color(0xFF5BC0BE).withOpacity(0.3)),
                        ),
                        child: Image.asset(
                          'assets/images/add_to_shopping_list.png',
                          height: 24,
                          width: 24,
                          color: const Color(0xFF6FFFE9), // Neon Ice instead of black
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  unitPrice,
                  style: const TextStyle(color: Color(0xFF5BC0BE), fontSize: 11, fontWeight: FontWeight.w500),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBottomNav() {
    return Container(
      height: 80,
      decoration: BoxDecoration(
        color: const Color(0xFF1C2541),
        border: Border(top: BorderSide(color: const Color(0xFF3A506B).withOpacity(0.5))),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _buildNavItem(Icons.local_offer_outlined, false),
          _buildNavItem(Icons.shopping_bag_outlined, false),
          _buildNavItem(Icons.home_filled, true),
          _buildNavItem(Icons.map_outlined, false),
          _buildNavItem(Icons.person_outline_rounded, false),
        ],
      ),
    );
  }

  Widget _buildNavItem(IconData icon, bool isActive) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(
          icon,
          color: isActive ? const Color(0xFF6FFFE9) : const Color(0xFF3A506B),
          size: 30,
        ),
        if (isActive)
          Container(
            margin: const EdgeInsets.only(top: 6),
            height: 4,
            width: 4,
            decoration: const BoxDecoration(color: Color(0xFF6FFFE9), shape: BoxShape.circle),
          ),
      ],
    );
  }
}
