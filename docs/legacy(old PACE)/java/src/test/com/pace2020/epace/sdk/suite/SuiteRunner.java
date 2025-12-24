package com.pace2020.epace.sdk.suite;

import java.io.IOException;
import java.net.URL;
import java.net.URLClassLoader;
import java.util.Collections;
import java.util.Enumeration;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.jar.JarEntry;
import java.util.jar.JarFile;

import org.junit.internal.builders.AllDefaultPossibilitiesBuilder;
import org.junit.runner.Description;
import org.junit.runner.Runner;
import org.junit.runner.notification.RunNotifier;
import org.junit.runners.ParentRunner;
import org.junit.runners.model.InitializationError;
import org.junit.runners.model.RunnerBuilder;

/**
 * @author <a href="mailto:jerry.duval@efi.com">jerry duval</a>
 */
public class SuiteRunner extends ParentRunner<Runner>
{
    /**
     * Called reflectively on classes annotated with <code>@RunWith(Suite.class)</code>
     *
     * @param klass
     *            the root class
     * @param builder
     *            builds runners for classes in the suite
     */
    public SuiteRunner( Class<?> klass, RunnerBuilder builder ) throws InitializationError
    {
        this( builder, klass, getAnnotatedClasses( klass ) );
    }

    /**
     * Call this when there is no single root class (for example, multiple class names passed on the command line to
     * {@link org.junit.runner.JUnitCore}
     *
     * @param builder
     *            builds runners for classes in the suite
     * @param classes
     *            the classes in the suite
     */
    public SuiteRunner( RunnerBuilder builder, Class<?>[] classes ) throws InitializationError
    {
        this( null, builder.runners( null, classes ) );
    }

    /**
     * Call this when the default builder is good enough. Left in for compatibility with JUnit 4.4.
     *
     * @param klass
     *            the root of the suite
     * @param suiteClasses
     *            the classes in the suite
     */
    protected SuiteRunner( Class<?> klass, Class<?>[] suiteClasses ) throws InitializationError
    {
        this( new AllDefaultPossibilitiesBuilder( false ), klass, suiteClasses );
    }

    /**
     * Called by this class and subclasses once the classes making up the suite have been determined
     *
     * @param builder
     *            builds runners for classes in the suite
     * @param klass
     *            the root of the suite
     * @param suiteClasses
     *            the classes in the suite
     */
    protected SuiteRunner( RunnerBuilder builder, Class<?> klass, Class<?>[] suiteClasses )
        throws InitializationError
    {
        this( klass, builder.runners( klass, suiteClasses ) );
    }

    /**
     * Called by this class and subclasses once the runners making up the suite have been determined
     *
     * @param klass
     *            root of the suite
     * @param runners
     *            for each class in the suite, a {@link org.junit.runner.Runner}
     */
    protected SuiteRunner( Class<?> klass, List<Runner> runners ) throws InitializationError
    {
        super( klass );
        this.runners = Collections.unmodifiableList( runners );
    }

    private static Class<?>[] getAnnotatedClasses( Class<?> klass ) throws InitializationError
    {
        final IncludeJars includedJars = klass.getAnnotation( IncludeJars.class );
        if( includedJars == null )
        {
            throw new InitializationError( String.format( "class '%s' must have a IncludeJars annotation",
                                                          klass.getName() ) );
        }

        try
        {
            final String[] include = null != includedJars ? includedJars.value() : null;

            final Set<Class<?>> classesFromJars = new LinkedHashSet<>();
            for( int i = 0; i < include.length; i++ )
            {
                Set<Class<?>> classesFromJar = getClassesFromJar( include[0] );
                classesFromJars.addAll( classesFromJar );
            }

            if( null == classesFromJars || classesFromJars.size() == 0 )
            {
                throw new InitializationError( String.format( "Included Jars in class '%s' does not have test classes",
                                                              klass.getName() ) );
            }

            System.out.println( "Found "+classesFromJars.size()+"Classes to Run"  );

            return classesFromJars.toArray( new Class[ classesFromJars.size() ] );
        }
        catch( Exception e )
        {
            throw new InitializationError( e.getMessage() );
        }
    }

    private final List<Runner> runners;

    @Override
    protected List<Runner> getChildren()
    {
        return runners;
    }

    @Override
    protected Description describeChild( Runner child )
    {
        return child.getDescription();
    }

    @Override
    protected void runChild( Runner runner, final RunNotifier notifier )
    {
        runner.run( notifier );
    }

    /*
     * (non-Javadoc)
     * @see org.junit.runners.ParentRunner#run(org.junit.runner.notification.RunNotifier)
     */
    @Override
    public void run( RunNotifier runNotifier )
    {
        runNotifier.addListener( new SuiteRunListener() );
        super.run( runNotifier );
    }

    private static Set<Class<?>> getClassesFromJar( final String jarName ) throws ClassNotFoundException, IOException
    {
        ClassLoader classLoader = Thread.currentThread().getContextClassLoader();
        final URL resource = classLoader.getResource( jarName );
        String file = resource.getFile();
        JarFile jarFile = new JarFile( file );
        final Enumeration<JarEntry> entries = jarFile.entries();

        URL[] urls = { new URL( "jar:file:" + jarName + "!/" ) };
        URLClassLoader cl = URLClassLoader.newInstance( urls );
        final Set<Class<?>> classes = new LinkedHashSet<>();

        try
        {
            while( entries.hasMoreElements() )
            {
                JarEntry je = entries.nextElement();
                if( je.isDirectory() || !je.getName().endsWith( ".class" ) )
                {
                    continue;
                }

                String className = je.getName().substring( 0, je.getName().length() - 6 );
                className = className.replace( '/', '.' );
                Class<?> c = cl.loadClass( className );
                classes.add( c );
            }
        }
        finally
        {
            if( null != jarFile )
            {
                jarFile.close();
            }
        }

        return classes;
    }
}
