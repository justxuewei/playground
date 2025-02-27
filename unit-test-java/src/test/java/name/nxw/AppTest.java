package name.nxw;

import junit.framework.Test;
import junit.framework.TestCase;
import junit.framework.TestSuite;

/**
 * Unit test for simple App.
 */
public class AppTest extends TestCase {
    private App app;

    /**
     * Create the test case
     *
     * @param testName name of the test case
     */
    public AppTest(String testName) {
        super(testName);
        app = new App();
    }

    /**
     * @return the suite of tests being tested
     */
    public static Test suite() {
        return new TestSuite(AppTest.class);
    }

    /**
     * Rigourous Test :-)
     */
    public void testApp() {
        assertTrue(true);
    }

    public void testAdd() {
        int a = 1;
        int b = 2;
        int result = app.add(a, b);
        System.out.println("---" + Thread.currentThread().getName());
        assertEquals(a + b, result);
    }

    public void testSubtract() {
        int a = 1;
        int b = 2;
        int result = app.subtract(a, b);
        System.out.println("---" + Thread.currentThread().getName());
        assertEquals(a - b, result);
    }
}
