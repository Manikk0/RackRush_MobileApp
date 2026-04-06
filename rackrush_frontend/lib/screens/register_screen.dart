import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/api_service.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  bool _isLoading = false;
  bool _obscurePassword = true;
  bool _obscureConfirmPassword = true;

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);

    final apiService = Provider.of<ApiService>(context, listen: false);
    final success = await apiService.register(
      _nameController.text.trim(),
      _emailController.text.trim(),
      _passwordController.text,
    );

    setState(() => _isLoading = false);

    if (success && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Registrácia úspešná!'),
          backgroundColor: Color(0xFF5BC0BE),
          behavior: SnackBarBehavior.floating,
        ),
      );
      Navigator.of(context).pushReplacementNamed('/login');
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Registrácia zlyhala.'),
          backgroundColor: Colors.redAccent,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFF0B132B), Color(0xFF1C2541)],
          ),
        ),
        child: SafeArea(
          child: Column(
            children: [
              AppBar(
                backgroundColor: Colors.transparent,
                elevation: 0,
                leading: IconButton(
                  icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Color(0xFF6FFFE9)),
                  onPressed: () => Navigator.of(context).pushReplacementNamed('/login'),
                ),
                title: const Text('VYTVORIŤ ÚČET', style: TextStyle(letterSpacing: 2, fontSize: 16, fontWeight: FontWeight.bold)),
                centerTitle: true,
              ),
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(horizontal: 30),
                  child: Form(
                    key: _formKey,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const SizedBox(height: 20),
                        Center(
                          child: Image.asset(
                            'assets/images/logo.png',
                            height: 60,
                            width: 60,
                            fit: BoxFit.contain,
                          ),
                        ),
                        const SizedBox(height: 20),
                        const Text(
                          'Pridaj sa k nám',
                          textAlign: TextAlign.center,
                          style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: Colors.white),
                        ),
                        const SizedBox(height: 10),
                        const Text(
                          'Začni nakupovať inteligentne s RackRush',
                          textAlign: TextAlign.center,
                          style: TextStyle(color: Color(0xFF5BC0BE), fontSize: 14),
                        ),
                        const SizedBox(height: 50),
                        TextFormField(
                          controller: _nameController,
                          style: const TextStyle(color: Colors.white),
                          decoration: const InputDecoration(
                            hintText: 'Celé meno',
                            prefixIcon: Icon(Icons.person_outline_rounded, color: Color(0xFF5BC0BE)),
                          ),
                          validator: (val) => val == null || val.isEmpty ? 'Zadajte svoje meno' : null,
                        ),
                        const SizedBox(height: 20),
                        TextFormField(
                          controller: _emailController,
                          style: const TextStyle(color: Colors.white),
                          decoration: const InputDecoration(
                            hintText: 'Emailová adresa',
                            prefixIcon: Icon(Icons.alternate_email_rounded, color: Color(0xFF5BC0BE)),
                          ),
                          keyboardType: TextInputType.emailAddress,
                          validator: (val) => val == null || !val.contains('@') ? 'Zadajte platný email' : null,
                        ),
                        const SizedBox(height: 20),
                        TextFormField(
                          controller: _passwordController,
                          style: const TextStyle(color: Colors.white),
                          obscureText: _obscurePassword,
                          decoration: InputDecoration(
                            hintText: 'Heslo',
                            prefixIcon: const Icon(Icons.lock_outline_rounded, color: Color(0xFF5BC0BE)),
                            suffixIcon: IconButton(
                              icon: Icon(
                                _obscurePassword ? Icons.visibility_off_rounded : Icons.visibility_rounded,
                                color: const Color(0xFF3A506B),
                              ),
                              onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                            ),
                          ),
                          validator: (val) => val == null || val.length < 6 ? 'Minimálne 6 znakov' : null,
                        ),
                        const SizedBox(height: 20),
                        TextFormField(
                          controller: _confirmPasswordController,
                          style: const TextStyle(color: Colors.white),
                          obscureText: _obscureConfirmPassword,
                          decoration: InputDecoration(
                            hintText: 'Zopakujte heslo',
                            prefixIcon: const Icon(Icons.lock_reset_rounded, color: Color(0xFF5BC0BE)),
                            suffixIcon: IconButton(
                              icon: Icon(
                                _obscureConfirmPassword ? Icons.visibility_off_rounded : Icons.visibility_rounded,
                                color: const Color(0xFF3A506B),
                              ),
                              onPressed: () => setState(() => _obscureConfirmPassword = !_obscureConfirmPassword),
                            ),
                          ),
                          validator: (val) => val != _passwordController.text ? 'Heslá sa nezhodujú' : null,
                        ),
                        const SizedBox(height: 40),
                        _isLoading
                            ? const Center(child: CircularProgressIndicator(color: Color(0xFF6FFFE9)))
                            : ElevatedButton(
                                onPressed: _submit,
                                child: const Text('ZAREGISTROVAŤ SA'),
                              ),
                        const SizedBox(height: 40),
                        Row(
                          children: [
                            const Expanded(child: Divider(color: Color(0xFF3A506B))),
                            Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 15),
                              child: Text(
                                'ALEBO REGISTRÁCIA CEZ',
                                style: TextStyle(color: const Color(0xFF3A506B).withOpacity(0.8), fontSize: 10),
                              ),
                            ),
                            const Expanded(child: Divider(color: Color(0xFF3A506B))),
                          ],
                        ),
                        const SizedBox(height: 30),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            _buildSocialBtn(
                              onPressed: () {},
                              iconPath: 'assets/images/google.png',
                            ),
                            const SizedBox(width: 25),
                            _buildSocialBtn(
                              onPressed: () {},
                              iconPath: 'assets/images/facebook.png',
                            ),
                          ],
                        ),
                        const SizedBox(height: 40),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSocialBtn({required VoidCallback onPressed, required String iconPath}) {
    return Container(
      height: 60,
      width: 60,
      decoration: BoxDecoration(
        color: const Color(0xFF1C2541),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFF3A506B)),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onPressed,
          borderRadius: BorderRadius.circular(20),
          child: Padding(
            padding: const EdgeInsets.all(15),
            child: Image.asset(iconPath),
          ),
        ),
      ),
    );
  }
}
