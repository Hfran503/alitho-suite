package com.pace2020.epace.sdk.suite;

import java.lang.annotation.ElementType;
import java.lang.annotation.Inherited;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * @author <a href="mailto:jerry.duval@efi.com">jerry duval</a>
 */
@Retention( RetentionPolicy.RUNTIME )
@Target( ElementType.TYPE )
@Inherited
public @interface IncludeJars
{
    public String[] value( );
}
